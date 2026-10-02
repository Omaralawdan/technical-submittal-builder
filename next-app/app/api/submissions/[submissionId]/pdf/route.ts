import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  PDFArray,
  PDFDocument,
  PDFName,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import { createServerSupabaseClient} from '@/lib/supabase-server';

type Project = {
  project_name: string;
  client_name: string | null;
  consultant: string | null;
  contractor: string | null;
  client_logo_path: string | null;
  consultant_logo_path: string | null;
  contractor_logo_path: string | null;
};

type CompanyBranding = {
  petrokima_logo_path: string | null;
  siemens_logo_path: string | null;
};

type Submission = {
  id: string;
  revision: string;
  submission_date: string | null;
  status: string | null;
};

type Structure = {
  id: string;
  submission_id: string;
  structure_name: string;
};

type Section = {
  id: string;
  structure_id: string;
  section_type_id: string | null;
  title: string;
  section_order: number;
  is_custom: boolean;
  is_required: boolean;
};

type SubmissionContent = {
  id: string;
  submission_id: string;
  section_id: string;
  title: string;
  source_type: string;
  file_name: string | null;
  file_path: string | null;
  content_order: number;
};

type PreparedContent = {
  content: SubmissionContent;
  bytes: Uint8Array | null;
  kind: 'pdf' | 'image' | 'unsupported' | 'empty';
};

type PreparedSection = {
  section: Section;
  contents: PreparedContent[];
  contentPageCount: number;
};

type PageInfo = {
  sectionId: string;
  sectionTitle: string;
  tocPage: number;
  sectionPage: number;
  contentPageCount: number;
};

type EmbeddedImage =
  Awaited<
    ReturnType<PDFDocument['embedPng']>
  >;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN_LEFT = 55;
const MARGIN_RIGHT = 55;
const MARGIN_TOP = 55;
const MARGIN_BOTTOM = 55;

const FOOTER_Y = 25;

const PETROKIMA_DARK_RED = rgb(
  0.35,
  0.02,
  0.02
);

const PETROKIMA_RED = rgb(
  0.72,
  0.04,
  0.04
);

const LIGHT_RED = rgb(
  0.97,
  0.93,
  0.93
);

function normalizeTitle(title: string) {
  return title.trim().toLowerCase();
}

function isPdf(content: SubmissionContent) {
  const name =
    content.file_name?.toLowerCase() || '';

  const path =
    content.file_path?.toLowerCase() || '';

  return (
    name.endsWith('.pdf') ||
    path.endsWith('.pdf')
  );
}

function isImage(content: SubmissionContent) {
  const name =
    content.file_name?.toLowerCase() || '';

  const path =
    content.file_path?.toLowerCase() || '';

  return (
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg') ||
    path.endsWith('.webp')
  );
}

function getImageType(
  content: SubmissionContent
) {
  const name =
    content.file_name?.toLowerCase() || '';

  const path =
    content.file_path?.toLowerCase() || '';

  if (
    name.endsWith('.png') ||
    path.endsWith('.png')
  ) {
    return 'png';
  }

  if (
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg')
  ) {
    return 'jpg';
  }

  if (
    name.endsWith('.webp') ||
    path.endsWith('.webp')
  ) {
    return 'webp';
  }

  return null;
}

function getStorageImageType(
  filePath: string
) {
  const path =
    filePath.toLowerCase();

  if (path.endsWith('.png')) {
    return 'png';
  }

  if (
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg')
  ) {
    return 'jpg';
  }

  return null;
}

async function getFileBytes(
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >,
  filePath: string
) {
  const { data, error } =
    await supabase.storage
      .from('documents')
      .download(filePath);

  if (error || !data) {
    throw new Error(
      `Unable to download file "${filePath}": ${
        error?.message ||
        'Unknown storage error'
      }`
    );
  }

  return new Uint8Array(
    await data.arrayBuffer()
  );
}

async function getStorageImageBytes(
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >,
  bucket: string,
  filePath: string
) {
  try {
    const { data, error } =
      await supabase.storage
        .from(bucket)
        .download(filePath);

    if (error || !data) {
      console.error(
        `Unable to download storage image "${bucket}/${filePath}":`,
        error?.message || 'No data returned'
      );

      return null;
    }

    return new Uint8Array(
      await data.arrayBuffer()
    );
  } catch (error) {
    console.error(
      `Storage image download failed "${bucket}/${filePath}":`,
      error
    );

    return null;
  }
}

async function embedStorageImage(
  pdfDoc: PDFDocument,
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >,
  bucket: string,
  filePath: string | null
): Promise<EmbeddedImage | null> {
  if (!filePath) {
    return null;
  }

  const imageType =
    getStorageImageType(filePath);

  if (!imageType) {
    console.warn(
      `Unsupported PDF logo format: ${bucket}/${filePath}. ` +
      'Only PNG/JPG/JPEG are currently supported.'
    );

    return null;
  }

  const bytes =
    await getStorageImageBytes(
      supabase,
      bucket,
      filePath
    );

  if (!bytes) {
    return null;
  }

  try {
    if (imageType === 'png') {
      return await pdfDoc.embedPng(
        bytes
      );
    }

    return await pdfDoc.embedJpg(
      bytes
    );
  } catch (error) {
    console.error(
      `Unable to embed storage image "${bucket}/${filePath}":`,
      error
    );

    return null;
  }
}

async function prepareContent(
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >,
  content: SubmissionContent
): Promise<PreparedContent> {
  if (!content.file_path) {
    return {
      content,
      bytes: null,
      kind: 'empty',
    };
  }

  if (
    isPdf(content) ||
    isImage(content)
  ) {
    const bytes =
      await getFileBytes(
        supabase,
        content.file_path
      );

    return {
      content,
      bytes,
      kind: isPdf(content)
        ? 'pdf'
        : 'image',
    };
  }

  return {
    content,
    bytes: null,
    kind: 'unsupported',
  };
}

type PdfTextOptions = {
  x: number;
  y: number;
  size: number;
  font: Awaited<
    ReturnType<PDFDocument['embedFont']>
  >;
  color?: ReturnType<typeof rgb>;
  [key: string]: unknown;
};

/*
 * Stable PDF text renderer.
 *
 * Arabic rendering is intentionally disabled for now.
 * The PDF uses the normal pdf-lib text renderer so the
 * rest of the Technical Submittal PDF remains stable.
 */
function drawPdfText(
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  options: PdfTextOptions
) {
  page.drawText(
    text,
    options
  );
}

function drawFooter(
  page: ReturnType<
    PDFDocument['addPage']
  >,
  font: Awaited<
    ReturnType<PDFDocument['embedFont']>
  >,
  pageNumber: number
) {
  const text = `${pageNumber}`;

  const textWidth =
    font.widthOfTextAtSize(
      text,
      8
    );

  drawPdfText(page, text, {
    x:
      (PAGE_WIDTH - textWidth) /
      2,
    y: FOOTER_Y,
    size: 8,
    font,
    color: rgb(
      0.45,
      0.45,
      0.45
    ),
  });
}

function drawPageHeader(
  page: ReturnType<
    PDFDocument['addPage']
  >,
  font: Awaited<
    ReturnType<PDFDocument['embedFont']>
  >,
  projectName: string,
  systemName: string
) {
  drawPdfText(page, 
    'TECHNICAL SUBMITTAL',
    {
      x: MARGIN_LEFT,
      y:
        PAGE_HEIGHT -
        MARGIN_TOP,
      size: 8,
      font,
      color: rgb(
        0.45,
        0.45,
        0.45
      ),
    }
  );

  const rightText =
    `${projectName} · ${systemName}`;

  const rightWidth =
    font.widthOfTextAtSize(
      rightText,
      8
    );

  drawPdfText(page, 
    rightText,
    {
      x:
        PAGE_WIDTH -
        MARGIN_RIGHT -
        rightWidth,
      y:
        PAGE_HEIGHT -
        MARGIN_TOP,
      size: 8,
      font,
      color: rgb(
        0.45,
        0.45,
        0.45
      ),
    }
  );
}

function drawLogo(
  page: ReturnType<
    PDFDocument['addPage']
  >,
  image: EmbeddedImage | null,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (!image) {
    return;
  }

  const dimensions =
    image.scale(1);

  const scale =
    Math.min(
      width /
        dimensions.width,
      height /
        dimensions.height
    );

  const drawWidth =
    dimensions.width * scale;

  const drawHeight =
    dimensions.height * scale;

  page.drawImage(
    image,
    {
      x:
        x +
        (width - drawWidth) /
          2,
      y:
        y +
        (height - drawHeight) /
          2,
      width:
        drawWidth,
      height:
        drawHeight,
    }
  );
}

function drawCoverPage(
  page: ReturnType<
    PDFDocument['addPage']
  >,
  regularFont: Awaited<
    ReturnType<PDFDocument['embedFont']>
  >,
  boldFont: Awaited<
    ReturnType<PDFDocument['embedFont']>
  >,
  project: Project,
  systemName: string,
  submission: Submission,
  petrokimaLogo: EmbeddedImage | null,
  siemensLogo: EmbeddedImage | null,
  clientLogo: EmbeddedImage | null,
  consultantLogo: EmbeddedImage | null,
  contractorLogo: EmbeddedImage | null,
  pageNumber: number
) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(1, 1, 1),
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: PETROKIMA_DARK_RED,
  });

  drawLogo(
    page,
    petrokimaLogo,
    MARGIN_LEFT,
    PAGE_HEIGHT - 92,
    150,
    55
  );

  drawLogo(
    page,
    siemensLogo,
    PAGE_WIDTH -
      MARGIN_RIGHT -
      150,
    PAGE_HEIGHT - 92,
    150,
    55
  );

  page.drawRectangle({
    x: MARGIN_LEFT,
    y: PAGE_HEIGHT - 108,
    width:
      PAGE_WIDTH -
      MARGIN_LEFT -
      MARGIN_RIGHT,
    height: 4,
    color: PETROKIMA_RED,
  });

  drawPdfText(page, 
    'TECHNICAL SUBMITTAL',
    {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 180,
      size: 29,
      font: boldFont,
      color: PETROKIMA_DARK_RED,
    }
  );

  const safeSystemName =
    systemName?.trim() || 'System';

  drawPdfText(page, 
    safeSystemName.toUpperCase(),
    {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 218,
      size:
        safeSystemName.length > 42
          ? 16
          : 20,
      font: boldFont,
      color: rgb(
        0.08,
        0.08,
        0.08
      ),
      maxWidth:
        PAGE_WIDTH -
        MARGIN_LEFT -
        MARGIN_RIGHT,
    }
  );

  drawPdfText(page, 
    project.project_name,
    {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 248,
      size: 12,
      font: regularFont,
      color: rgb(
        0.4,
        0.4,
        0.4
      ),
      maxWidth:
        PAGE_WIDTH -
        MARGIN_LEFT -
        MARGIN_RIGHT,
    }
  );

  const infoX = MARGIN_LEFT;
  const infoY = 425;
  const infoWidth =
    PAGE_WIDTH -
    MARGIN_LEFT -
    MARGIN_RIGHT;
  const infoHeight = 145;

  page.drawRectangle({
    x: infoX,
    y: infoY,
    width: infoWidth,
    height: infoHeight,
    color: rgb(
      0.985,
      0.985,
      0.985
    ),
    borderColor: rgb(
      0.84,
      0.84,
      0.84
    ),
    borderWidth: 0.8,
  });

  page.drawRectangle({
    x: infoX,
    y:
      infoY +
      infoHeight -
      30,
    width: infoWidth,
    height: 30,
    color: PETROKIMA_DARK_RED,
  });

  drawPdfText(page, 
    'PROJECT INFORMATION',
    {
      x: infoX + 14,
      y:
        infoY +
        infoHeight -
        20,
      size: 9,
      font: boldFont,
      color: rgb(1, 1, 1),
    }
  );

  const infoRows = [
    [
      'Project Name',
      project.project_name || '-',
    ],
    [
      'Client',
      project.client_name || '-',
    ],
    [
      'Consultant',
      project.consultant || '-',
    ],
    [
      'Contractor',
      project.contractor || '-',
    ],
  ];

  let infoRowY =
    infoY +
    infoHeight -
    52;

  for (
    const [label, value] of infoRows
  ) {
    drawPdfText(page, 
      label,
      {
        x: infoX + 14,
        y: infoRowY,
        size: 8,
        font: boldFont,
        color: rgb(
          0.4,
          0.4,
          0.4
        ),
      }
    );

    drawPdfText(page, 
      value,
      {
        x: infoX + 125,
        y: infoRowY,
        size: 8.5,
        font: regularFont,
        color: rgb(
          0.08,
          0.08,
          0.08
        ),
        maxWidth:
          infoWidth - 140,
      }
    );

    infoRowY -= 22;
  }

  const dateText =
    submission.submission_date
      ? new Date(
          submission.submission_date
        ).toLocaleDateString(
          'en-GB',
          {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }
        )
      : '-';

  const metaY = 345;

  drawPdfText(page, 
    'SUBMISSION DATE',
    {
      x: MARGIN_LEFT,
      y: metaY,
      size: 7,
      font: boldFont,
      color: rgb(
        0.45,
        0.45,
        0.45
      ),
    }
  );

  drawPdfText(page, 
    dateText,
    {
      x: MARGIN_LEFT,
      y: metaY - 16,
      size: 10,
      font: boldFont,
      color: rgb(
        0.08,
        0.08,
        0.08
      ),
    }
  );

  drawPdfText(page, 
    'REVISION',
    {
      x: 285,
      y: metaY,
      size: 7,
      font: boldFont,
      color: rgb(
        0.45,
        0.45,
        0.45
      ),
    }
  );

  drawPdfText(page, 
    `Rev. ${submission.revision}`,
    {
      x: 285,
      y: metaY - 16,
      size: 10,
      font: boldFont,
      color: rgb(
        0.08,
        0.08,
        0.08
      ),
    }
  );

  const stakeholderY = 150;
  const cardWidth = 145;
  const cardHeight = 105;
  const gap = 15;

  const stakeholderCards = [
    {
      title: 'CLIENT',
      name:
        project.client_name ||
        '-',
      logo: clientLogo,
      x: MARGIN_LEFT,
    },
    {
      title: 'CONSULTANT',
      name:
        project.consultant ||
        '-',
      logo: consultantLogo,
      x:
        MARGIN_LEFT +
        cardWidth +
        gap,
    },
    {
      title: 'CONTRACTOR',
      name:
        project.contractor ||
        '-',
      logo: contractorLogo,
      x:
        MARGIN_LEFT +
        (cardWidth + gap) * 2,
    },
  ];

  for (
    const card of stakeholderCards
  ) {
    page.drawRectangle({
      x: card.x,
      y: stakeholderY,
      width: cardWidth,
      height: cardHeight,
      color: rgb(
        1,
        1,
        1
      ),
      borderColor: rgb(
        0.85,
        0.85,
        0.85
      ),
      borderWidth: 0.8,
    });

    drawPdfText(page, 
      card.title,
      {
        x: card.x + 10,
        y:
          stakeholderY +
          cardHeight -
          17,
        size: 7,
        font: boldFont,
        color: PETROKIMA_RED,
      }
    );

    drawLogo(
      page,
      card.logo,
      card.x + 10,
      stakeholderY + 31,
      cardWidth - 20,
      45
    );

    if (!card.logo) {
      drawPdfText(page, 
        card.name,
        {
          x: card.x + 10,
          y:
            stakeholderY + 48,
          size: 8,
          font: boldFont,
          color: rgb(
            0.25,
            0.25,
            0.25
          ),
          maxWidth:
            cardWidth - 20,
        }
      );
    }

    page.drawLine({
      start: {
        x: card.x + 10,
        y: stakeholderY + 25,
      },
      end: {
        x:
          card.x +
          cardWidth -
          10,
        y: stakeholderY + 25,
      },
      thickness: 0.5,
      color: rgb(
        0.88,
        0.88,
        0.88
      ),
    });

    drawPdfText(page, 
      card.name,
      {
        x: card.x + 10,
        y: stakeholderY + 10,
        size: 6.5,
        font: regularFont,
        color: rgb(
          0.45,
          0.45,
          0.45
        ),
        maxWidth:
          cardWidth - 20,
      }
    );
  }

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: 34,
    color: PETROKIMA_DARK_RED,
  });

  drawPdfText(page, 
    'PETROKIMA Engineering & Contracting',
    {
      x: MARGIN_LEFT,
      y: 12,
      size: 7.5,
      font: boldFont,
      color: rgb(1, 1, 1),
    }
  );

  const footerRight =
    `Rev. ${submission.revision} | ${pageNumber}`;

  const footerRightWidth =
    regularFont.widthOfTextAtSize(
      footerRight,
      7.5
    );

  drawPdfText(page, 
    footerRight,
    {
      x:
        PAGE_WIDTH -
        MARGIN_RIGHT -
        footerRightWidth,
      y: 12,
      size: 7.5,
      font: regularFont,
      color: rgb(1, 1, 1),
    }
  );
}

function drawSectionTitle(
  page: ReturnType<
    PDFDocument['addPage']
  >,
  regularFont: Awaited<
    ReturnType<PDFDocument['embedFont']>
  >,
  boldFont: Awaited<
    ReturnType<PDFDocument['embedFont']>
  >,
  sectionNumber: number,
  sectionTitle: string,
  projectName: string,
  systemName: string,
  project: Project,
  submission: Submission,
  petrokimaLogo: EmbeddedImage | null,
  siemensLogo: EmbeddedImage | null,
  clientLogo: EmbeddedImage | null,
  consultantLogo: EmbeddedImage | null,
  contractorLogo: EmbeddedImage | null,
  pageNumber: number
) {
  if (
    normalizeTitle(
      sectionTitle
    ) === 'cover'
  ) {
    drawCoverPage(
      page,
      regularFont,
      boldFont,
      project,
      systemName,
      submission,
      petrokimaLogo,
      siemensLogo,
      clientLogo,
      consultantLogo,
      contractorLogo,
      pageNumber
    );

    return;
  }

  drawPageHeader(
    page,
    regularFont,
    projectName,
    systemName
  );

  page.drawLine({
    start: {
      x: MARGIN_LEFT,
      y:
        PAGE_HEIGHT -
        MARGIN_TOP -
        22,
    },
    end: {
      x:
        PAGE_WIDTH -
        MARGIN_RIGHT,
      y:
        PAGE_HEIGHT -
        MARGIN_TOP -
        22,
    },
    thickness: 1.5,
    color: PETROKIMA_RED,
  });

  drawPdfText(page, 
    `SECTION ${String(
      sectionNumber
    ).padStart(2, '0')}`,
    {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 145,
      size: 9,
      font: boldFont,
      color: rgb(
        0.4,
        0.4,
        0.4
      ),
    }
  );

  const titleSize =
    sectionTitle.length > 55
      ? 22
      : 28;

  drawPdfText(page, 
    sectionTitle,
    {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 190,
      size: titleSize,
      font: boldFont,
      color: rgb(
        0.08,
        0.08,
        0.08
      ),
      maxWidth:
        PAGE_WIDTH -
        MARGIN_LEFT -
        MARGIN_RIGHT,
    }
  );

  drawPdfText(page, 
    `${projectName} · ${systemName}`,
    {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 220,
      size: 9,
      font: regularFont,
      color: rgb(
        0.45,
        0.45,
        0.45
      ),
    }
  );
}

function drawTocPage(
  page: ReturnType<
    PDFDocument['addPage']
  >,
  regularFont: Awaited<
    ReturnType<PDFDocument['embedFont']>
  >,
  boldFont: Awaited<
    ReturnType<PDFDocument['embedFont']>
  >,
  projectName: string,
  systemName: string,
  activeSectionId: string,
  sections: Section[],
  pageInfoMap: Map<
    string,
    PageInfo
  >
) {
  drawPageHeader(
    page,
    regularFont,
    projectName,
    systemName
  );

  drawPdfText(page, 
    'TABLE OF CONTENTS',
    {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 115,
      size: 24,
      font: boldFont,
      color: rgb(
        0.08,
        0.08,
        0.08
      ),
    }
  );

  page.drawLine({
    start: {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 135,
    },
    end: {
      x:
        PAGE_WIDTH -
        MARGIN_RIGHT,
      y: PAGE_HEIGHT - 135,
    },
    thickness: 1.5,
    color: PETROKIMA_RED,
  });

  let y =
    PAGE_HEIGHT - 175;

  sections.forEach(
    (section, index) => {
      const info =
        pageInfoMap.get(
          section.id
        );

      if (!info) {
        return;
      }

      const isActive =
        section.id ===
        activeSectionId;

      if (isActive) {
        page.drawRectangle({
          x:
            MARGIN_LEFT - 8,
          y: y - 8,
          width:
            PAGE_WIDTH -
            MARGIN_LEFT -
            MARGIN_RIGHT +
            16,
          height: 28,
          color: LIGHT_RED,
        });

        page.drawRectangle({
          x:
            MARGIN_LEFT - 8,
          y: y - 8,
          width: 4,
          height: 28,
          color: PETROKIMA_RED,
        });
      }

      const numberText =
        String(index + 1)
          .padStart(2, '0');

      drawPdfText(page, 
        numberText,
        {
          x: MARGIN_LEFT,
          y,
          size: 9,
          font: regularFont,
          color: rgb(
            0.45,
            0.45,
            0.45
          ),
        }
      );

      drawPdfText(page, 
        section.title,
        {
          x:
            MARGIN_LEFT + 32,
          y,
          size: 10,
          font: isActive
            ? boldFont
            : regularFont,
          color: rgb(
            0.08,
            0.08,
            0.08
          ),
          maxWidth: 360,
        }
      );

      drawPdfText(page, 
        String(
          info.sectionPage
        ),
        {
          x:
            PAGE_WIDTH -
            MARGIN_RIGHT -
            25,
          y,
          size: 10,
          font: isActive
            ? boldFont
            : regularFont,
          color: rgb(
            0.08,
            0.08,
            0.08
          ),
        }
      );

      page.drawLine({
        start: {
          x:
            MARGIN_LEFT + 32,
          y: y - 5,
        },
        end: {
          x:
            PAGE_WIDTH -
            MARGIN_RIGHT -
            35,
          y: y - 5,
        },
        thickness: 0.5,
        color: rgb(
          0.82,
          0.82,
          0.82
        ),
      });

      y -= 34;
    }
  );

  drawPdfText(page, 
    `${projectName} · ${systemName}`,
    {
      x: MARGIN_LEFT,
      y: 55,
      size: 8,
      font: regularFont,
      color: rgb(
        0.5,
        0.5,
        0.5
      ),
    }
  );
}

function addInternalLink(
  page: ReturnType<
    PDFDocument['addPage']
  >,
  targetPage: ReturnType<
    PDFDocument['addPage']
  >,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const context =
    page.doc.context;

  const destination =
    context.obj([
      targetPage.ref,
      PDFName.of('Fit'),
    ]);

  const linkAnnotation =
    context.register(
      context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [
          x,
          y,
          x + width,
          y + height,
        ],
        Border: [0, 0, 0],
        Dest: destination,
      })
    );

  let annots =
    page.node.lookupMaybe(
      PDFName.of('Annots'),
      PDFArray
    );

  if (!annots) {
    annots =
      context.obj(
        []
      ) as PDFArray;

    page.node.set(
      PDFName.of('Annots'),
      annots
    );
  }

  annots.push(
    linkAnnotation
  );
}

function addPageNumberToImportedPage(
  page: ReturnType<
    PDFDocument['addPage']
  >,
  regularFont: Awaited<
    ReturnType<PDFDocument['embedFont']>
  >,
  pageNumber: number
) {
  const text =
    `${pageNumber}`;

  const textWidth =
    regularFont.widthOfTextAtSize(
      text,
      8
    );

  page.drawRectangle({
    x:
      PAGE_WIDTH / 2 -
      textWidth / 2 -
      4,
    y: 15,
    width:
      textWidth + 8,
    height: 14,
    color: rgb(
      1,
      1,
      1
    ),
    opacity: 0.85,
  });

  drawPdfText(page, 
    text,
    {
      x:
        (PAGE_WIDTH -
          textWidth) /
        2,
      y: 18,
      size: 8,
      font: regularFont,
      color: rgb(
        0.35,
        0.35,
        0.35
      ),
    }
  );
}

async function buildPreparedSections(
  supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  >,
  sections: Section[],
  contents: SubmissionContent[]
) {
  const result: PreparedSection[] =
    [];

  for (
    const section of sections
  ) {
    const sectionContents =
      contents
        .filter(
          (content) =>
            content.section_id ===
            section.id
        )
        .sort(
          (a, b) =>
            a.content_order -
            b.content_order
        );

    const preparedContents: PreparedContent[] =
      [];

    for (
      const content of sectionContents
    ) {
      preparedContents.push(
        await prepareContent(
          supabase,
          content
        )
      );
    }

    let contentPageCount = 0;

    for (
      const item of preparedContents
    ) {
      if (
        item.kind === 'pdf' &&
        item.bytes
      ) {
        const sourcePdf =
          await PDFDocument.load(
            item.bytes
          );

        contentPageCount +=
          sourcePdf.getPageCount();
      } else if (
        item.kind === 'image' &&
        item.bytes
      ) {
        contentPageCount += 1;
      } else {
        contentPageCount += 1;
      }
    }

    result.push({
      section,
      contents:
        preparedContents,
      contentPageCount,
    });
  }

  return result;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      submissionId: string;
    }>;
  }
) {
  try {
    const {
      submissionId,
    } = await context.params;

    if (!submissionId) {
      return NextResponse.json(
        {
          error:
            'Submission ID is required.',
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createServerSupabaseClient();

    /*
     * ---------------------------------------------------------
     * AUTHENTICATION
     * ---------------------------------------------------------
     */

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            'You must be logged in to generate a PDF.',
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * SUBMISSION
     * ---------------------------------------------------------
     */

    const {
      data: submission,
      error: submissionError,
    } =
      await supabase
        .from('submissions')
        .select(
          `
          id,
          revision,
          submission_date,
          status
          `
        )
        .eq(
          'id',
          submissionId
        )
        .single();

    if (
      submissionError ||
      !submission
    ) {
      return NextResponse.json(
        {
          error:
            submissionError?.message ||
            'Submission was not found.',
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * STRUCTURE
     * ---------------------------------------------------------
     */

    const {
      data: structure,
      error: structureError,
    } =
      await supabase
        .from(
          'submission_structures'
        )
        .select(
          `
          id,
          submission_id,
          structure_name
          `
        )
        .eq(
          'submission_id',
          submissionId
        )
        .order('id')
        .limit(1)
        .single();

    if (
      structureError ||
      !structure
    ) {
      return NextResponse.json(
        {
          error:
            structureError?.message ||
            'Submission structure was not found.',
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * SECTIONS
     * ---------------------------------------------------------
     */

    const {
      data: rawSections,
      error: sectionsError,
    } =
      await supabase
        .from(
          'submission_sections'
        )
        .select(
          `
          id,
          structure_id,
          section_type_id,
          title,
          section_order,
          is_custom,
          is_required
          `
        )
        .eq(
          'structure_id',
          structure.id
        )
        .order(
          'section_order',
          {
            ascending: true,
          }
        );

    if (sectionsError) {
      throw new Error(
        sectionsError.message
      );
    }

    /*
     * The database TOC row is only
     * a navigation template.
     */

    const sections: Section[] =
      (
        rawSections || []
      ).filter(
        (section) =>
          normalizeTitle(
            section.title
          ) !==
          'table of contents'
      );

    /*
     * ---------------------------------------------------------
     * CONTENT
     * ---------------------------------------------------------
     */

    const {
      data: contents,
      error: contentsError,
    } =
      await supabase
        .from(
          'submission_content'
        )
        .select(
          `
          id,
          submission_id,
          section_id,
          title,
          source_type,
          file_name,
          file_path,
          content_order
          `
        )
        .eq(
          'submission_id',
          submissionId
        )
        .order(
          'content_order',
          {
            ascending: true,
          }
        );

    if (contentsError) {
      throw new Error(
        contentsError.message
      );
    }

    /*
     * ---------------------------------------------------------
     * PROJECT / SYSTEM
     * ---------------------------------------------------------
     */

    let project: Project = {
      project_name:
        'Technical Submittal',
      client_name: null,
      consultant: null,
      contractor: null,
      client_logo_path: null,
      consultant_logo_path: null,
      contractor_logo_path: null,
    };

    let systemName =
      'System';

    const {
      data:
        submissionProjectSystem,
      error:
        submissionProjectSystemError,
    } =
      await supabase
        .from('submissions')
        .select(
          `
          project_system_id
          `
        )
        .eq(
          'id',
          submissionId
        )
        .single();

    if (
      submissionProjectSystemError
    ) {
      console.error(
        'Failed to load submission project/system:',
        submissionProjectSystemError.message
      );
    }

    /*
     * ---------------------------------------------------------
     * PROJECT
     * ---------------------------------------------------------
     */

    type SelectedProjectSystem = {
      id: string;
      project_id: string | null;
      custom_system_name: string | null;
      system_id: string | null;
      systems:
        | {
            name: string | null;
          }
        | {
            name: string | null;
          }[]
        | null;
    };

    let selectedProjectSystem:
      SelectedProjectSystem | null =
      null;

    if (
      submissionProjectSystem?.project_system_id
    ) {
      const {
        data: projectSystemData,
        error: projectSystemError,
      } =
        await supabase
          .from('project_systems')
          .select(
            `
            id,
            project_id,
            custom_system_name,
            system_id,
            systems (
              name
            )
            `
          )
          .eq(
            'id',
            submissionProjectSystem.project_system_id
          )
          .maybeSingle();

      if (projectSystemError) {
        console.error(
          'Failed to load selected project system:',
          projectSystemError.message
        );
      }

      if (projectSystemData) {
        selectedProjectSystem =
          projectSystemData as SelectedProjectSystem;
      }

      if (
        projectSystemData?.project_id
      ) {
        const {
          data: projectData,
          error: projectError,
        } =
          await supabase
            .from('projects')
            .select(
              `
              project_name,
              client_name,
              consultant,
              contractor,
              client_logo_path,
              consultant_logo_path,
              contractor_logo_path
              `
            )
            .eq(
              'id',
              projectSystemData.project_id
            )
            .single();

        if (projectError) {
          console.error(
            'Failed to load project:',
            projectError.message
          );
        }

        if (projectData) {
          project =
            projectData;
        }
      }
    }

    /*
     * ---------------------------------------------------------
     * SELECTED PROJECT SYSTEM
     * ---------------------------------------------------------
     *
     * The submission stores the selected project system in:
     *
     * submissions.project_system_id
     *
     * The selected system is therefore resolved through:
     *
     * submissions.project_system_id
     *        ↓
     * project_systems.id
     *        ↓
     * custom_system_name
     *
     * or
     *
     * project_systems.system_id
     *        ↓
     * systems.id
     *        ↓
     * systems.name
     *
     * Priority:
     *
     * 1. custom_system_name
     * 2. linked systems.name
     * 3. "System"
     * ---------------------------------------------------------
     */

    if (
      selectedProjectSystem
    ) {
      const customSystemName =
        typeof selectedProjectSystem.custom_system_name ===
        'string'
          ? selectedProjectSystem.custom_system_name.trim()
          : '';

      if (customSystemName) {
        systemName =
          customSystemName;
      } else {
        const linkedSystem =
          Array.isArray(
            selectedProjectSystem.systems
          )
            ? selectedProjectSystem.systems[0]
            : selectedProjectSystem.systems;

        const linkedSystemName =
          typeof linkedSystem?.name ===
          'string'
            ? linkedSystem.name.trim()
            : '';

        if (linkedSystemName) {
          systemName =
            linkedSystemName;
        }
      }

      console.log(
        'PDF project_system_id:',
        submissionProjectSystem?.project_system_id
      );

      console.log(
        'PDF selected project system:',
        selectedProjectSystem
      );

      console.log(
        'PDF FINAL SYSTEM NAME:',
        systemName
      );
    } else {
      console.warn(
        'PDF: selected project system was not found:',
        submissionProjectSystem?.project_system_id ||
          submissionId
      );
    }

    /*
     * ---------------------------------------------------------
     * COMPANY BRANDING
     * ---------------------------------------------------------
     *
     * Global PETROKIMA + Siemens logos.
     */

    let companyBranding: CompanyBranding = {
      petrokima_logo_path: null,
      siemens_logo_path: null,
    };

    const {
      data: brandingData,
      error: brandingError,
    } =
      await supabase
        .from(
          'company_branding'
        )
        .select(
          `
          petrokima_logo_path,
          siemens_logo_path
          `
        )
        .eq(
          'id',
          1
        )
        .maybeSingle();

    if (brandingError) {
      console.error(
        'Failed to load company branding:',
        brandingError.message
      );
    }

    if (brandingData) {
      companyBranding =
        brandingData;
    }

    /*
     * ---------------------------------------------------------
     * PREPARE FILES
     * ---------------------------------------------------------
     */

    const preparedSections =
      await buildPreparedSections(
        supabase,
        sections,
        contents || []
      );

    /*
     * ---------------------------------------------------------
     * CALCULATE PAGE NUMBERS
     *
     * Each section:
     *
     * TOC
     * SECTION / COVER
     * CONTENT...
     * ---------------------------------------------------------
     */

    const pageInfoMap =
      new Map<
        string,
        PageInfo
      >();

    let currentPageNumber =
      1;

    for (
      const prepared of
        preparedSections
    ) {
      const tocPage =
        currentPageNumber;

      const sectionPage =
        currentPageNumber + 1;

      pageInfoMap.set(
        prepared.section.id,
        {
          sectionId:
            prepared.section.id,
          sectionTitle:
            prepared.section.title,
          tocPage,
          sectionPage,
          contentPageCount:
            prepared.contentPageCount,
        }
      );

      currentPageNumber +=
        2 +
        prepared.contentPageCount;
    }

    /*
     * ---------------------------------------------------------
     * CREATE PDF
     * ---------------------------------------------------------
     */

    const pdfDoc =
      await PDFDocument.create();

    pdfDoc.registerFontkit(fontkit);

    const latinRegularFont =
      await pdfDoc.embedFont(
        StandardFonts.Helvetica
      );

    const latinBoldFont =
      await pdfDoc.embedFont(
        StandardFonts.HelveticaBold
      );

    const arabicFontBytes =
      await readFile(
        path.join(
          process.cwd(),
          'public',
          'fonts',
          'NotoNaskhArabic.ttf'
        )
      );

    const regularFont =
      await pdfDoc.embedFont(
        arabicFontBytes,
        {
          subset: false,
        }
      );

    const boldFont =
      await pdfDoc.embedFont(
        arabicFontBytes,
        {
          subset: false,
        }
      );

    /*
     * ---------------------------------------------------------
     * EMBED GLOBAL COMPANY LOGOS
     * ---------------------------------------------------------
     */

    const petrokimaLogo =
      await embedStorageImage(
        pdfDoc,
        supabase,
        'company-branding',
        companyBranding.petrokima_logo_path
      );

    const siemensLogo =
      await embedStorageImage(
        pdfDoc,
        supabase,
        'company-branding',
        companyBranding.siemens_logo_path
      );

    /*
     * ---------------------------------------------------------
     * EMBED PROJECT LOGOS
     * ---------------------------------------------------------
     */

    const clientLogo =
      await embedStorageImage(
        pdfDoc,
        supabase,
        'project-logos',
        project.client_logo_path
      );

    const consultantLogo =
      await embedStorageImage(
        pdfDoc,
        supabase,
        'project-logos',
        project.consultant_logo_path
      );

    const contractorLogo =
      await embedStorageImage(
        pdfDoc,
        supabase,
        'project-logos',
        project.contractor_logo_path
      );

    /*
     * Section ID -> actual PDF page.
     */

    const sectionDestinationPages =
      new Map<
        string,
        ReturnType<
          typeof pdfDoc.addPage
        >
      >();

    let actualPageNumber =
      0;

    /*
     * ---------------------------------------------------------
     * BUILD DOCUMENT
     * ---------------------------------------------------------
     */

    for (
      let sectionIndex = 0;
      sectionIndex <
      preparedSections.length;
      sectionIndex++
    ) {
      const prepared =
        preparedSections[
          sectionIndex
        ];

      /*
       * -------------------------------------------------------
       * TOC PAGE
       * -------------------------------------------------------
       */

      const tocPage =
        pdfDoc.addPage([
          PAGE_WIDTH,
          PAGE_HEIGHT,
        ]);

      actualPageNumber++;

      drawTocPage(
        tocPage,
        regularFont,
        boldFont,
        project.project_name,
        systemName,
        prepared.section.id,
        sections,
        pageInfoMap
      );

      drawFooter(
        tocPage,
        regularFont,
        actualPageNumber
      );

      /*
       * -------------------------------------------------------
       * SECTION / COVER PAGE
       * -------------------------------------------------------
       */

      const sectionPage =
        pdfDoc.addPage([
          PAGE_WIDTH,
          PAGE_HEIGHT,
        ]);

      actualPageNumber++;

      sectionDestinationPages.set(
        prepared.section.id,
        sectionPage
      );

      drawSectionTitle(
        sectionPage,
        regularFont,
        boldFont,
        sectionIndex + 1,
        prepared.section.title,
        project.project_name,
        systemName,
        project,
        submission,
        petrokimaLogo,
        siemensLogo,
        clientLogo,
        consultantLogo,
        contractorLogo,
        actualPageNumber
      );

      /*
       * Do not add the normal footer
       * to the Cover because the Cover
       * already has its own branded footer.
       */

      if (
        normalizeTitle(
          prepared.section.title
        ) !== 'cover'
      ) {
        drawFooter(
          sectionPage,
          regularFont,
          actualPageNumber
        );
      }

      /*
       * -------------------------------------------------------
       * CONTENT
       * -------------------------------------------------------
       */

      for (
        const item of
          prepared.contents
      ) {
        /*
         * PDF
         */

        if (
          item.kind === 'pdf' &&
          item.bytes
        ) {
          const sourcePdf =
            await PDFDocument.load(
              item.bytes
            );

          const copiedPages =
            await pdfDoc.copyPages(
              sourcePdf,
              sourcePdf.getPageIndices()
            );

          for (
            const copiedPage of
              copiedPages
          ) {
            pdfDoc.addPage(
              copiedPage
            );

            actualPageNumber++;

            addPageNumberToImportedPage(
              copiedPage,
              regularFont,
              actualPageNumber
            );
          }

          continue;
        }

        /*
         * IMAGE
         */

        if (
          item.kind === 'image' &&
          item.bytes
        ) {
          const imageType =
            getImageType(
              item.content
            );

          const page =
            pdfDoc.addPage([
              PAGE_WIDTH,
              PAGE_HEIGHT,
            ]);

          actualPageNumber++;

          let image;

          if (
            imageType === 'png'
          ) {
            image =
              await pdfDoc.embedPng(
                item.bytes
              );
          } else {
            if (
              imageType === 'webp'
            ) {
              drawPdfText(page, 
                item.content.file_name ||
                  'Unsupported WebP image',
                {
                  x: MARGIN_LEFT,
                  y:
                    PAGE_HEIGHT /
                    2,
                  size: 12,
                  font: regularFont,
                  color: rgb(
                    0.35,
                    0.35,
                    0.35
                  ),
                }
              );

              drawFooter(
                page,
                regularFont,
                actualPageNumber
              );

              continue;
            }

            image =
              await pdfDoc.embedJpg(
                item.bytes
              );
          }

          const imageDims =
            image.scale(1);

          const availableWidth =
            PAGE_WIDTH -
            MARGIN_LEFT -
            MARGIN_RIGHT;

          const availableHeight =
            PAGE_HEIGHT -
            MARGIN_TOP -
            MARGIN_BOTTOM -
            50;

          const scale =
            Math.min(
              availableWidth /
                imageDims.width,
              availableHeight /
                imageDims.height
            );

          const drawWidth =
            imageDims.width *
            scale;

          const drawHeight =
            imageDims.height *
            scale;

          page.drawImage(
            image,
            {
              x:
                (PAGE_WIDTH -
                  drawWidth) /
                2,
              y:
                PAGE_HEIGHT /
                  2 -
                drawHeight /
                  2,
              width:
                drawWidth,
              height:
                drawHeight,
            }
          );

          drawFooter(
            page,
            regularFont,
            actualPageNumber
          );

          continue;
        }

        /*
         * EMPTY / UNSUPPORTED
         */

        const page =
          pdfDoc.addPage([
            PAGE_WIDTH,
            PAGE_HEIGHT,
          ]);

        actualPageNumber++;

        drawPdfText(page, 
          item.content.title ||
            item.content.file_name ||
            'No preview available',
          {
            x: MARGIN_LEFT,
            y:
              PAGE_HEIGHT /
                2 +
              20,
            size: 14,
            font: boldFont,
            color: rgb(
              0.2,
              0.2,
              0.2
            ),
            maxWidth:
              PAGE_WIDTH -
              MARGIN_LEFT -
              MARGIN_RIGHT,
          }
        );

        drawPdfText(page, 
          'This file type is not currently rendered into the PDF.',
          {
            x: MARGIN_LEFT,
            y:
              PAGE_HEIGHT /
                2 -
              10,
            size: 9,
            font: regularFont,
            color: rgb(
              0.45,
              0.45,
              0.45
            ),
          }
        );

        drawFooter(
          page,
          regularFont,
          actualPageNumber
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * ADD INTERNAL TOC LINKS
     *
     * ANY TOC -> ANY SECTION
     * ---------------------------------------------------------
     */

    const allPages =
      pdfDoc.getPages();

    for (
      let tocSectionIndex = 0;
      tocSectionIndex <
      preparedSections.length;
      tocSectionIndex++
    ) {
      const tocOwner =
        preparedSections[
          tocSectionIndex
        ];

      const tocInfo =
        pageInfoMap.get(
          tocOwner.section.id
        );

      if (!tocInfo) {
        continue;
      }

      const tocPageIndex =
        tocInfo.tocPage - 1;

      const tocPage =
        allPages[
          tocPageIndex
        ];

      if (!tocPage) {
        continue;
      }

      for (
        let targetSectionIndex = 0;
        targetSectionIndex <
        preparedSections.length;
        targetSectionIndex++
      ) {
        const target =
          preparedSections[
            targetSectionIndex
          ];

        const destination =
          sectionDestinationPages.get(
            target.section.id
          );

        if (!destination) {
          continue;
        }

        const rowY =
          PAGE_HEIGHT -
          175 -
          targetSectionIndex *
            34;

        addInternalLink(
          tocPage,
          destination,
          MARGIN_LEFT - 8,
          rowY - 8,
          PAGE_WIDTH -
            MARGIN_LEFT -
            MARGIN_RIGHT +
            16,
          28
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * METADATA
     * ---------------------------------------------------------
     */

    pdfDoc.setTitle(
      `${project.project_name} - ${systemName} Technical Submittal`
    );

    pdfDoc.setAuthor(
      'Technical Submittal Builder'
    );

    pdfDoc.setSubject(
      `Technical Submittal - Revision ${submission.revision}`
    );

    pdfDoc.setCreator(
      'Technical Submittal Builder'
    );

    /*
     * ---------------------------------------------------------
     * SAVE
     * ---------------------------------------------------------
     */

    const pdfBytes =
      await pdfDoc.save();

    const fileName =
      `${project.project_name
        .replace(
          /[^a-zA-Z0-9-_ ]/g,
          ''
        )
        .replace(
          /\s+/g,
          '_'
        )}_Technical_Submittal_Rev_${submission.revision}.pdf`;

    return new NextResponse(
      Buffer.from(pdfBytes),
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/pdf',
          'Content-Disposition':
            `attachment; filename="${fileName}"`,
          'Cache-Control':
            'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'PDF generation error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate PDF.',
      },
      {
        status: 500,
      }
    );
  }
}
