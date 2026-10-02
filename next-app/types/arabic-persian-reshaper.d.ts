declare module 'arabic-persian-reshaper' {
  const reshaper: {
    PersianShaper: {
      convertArabic(text: string): string;
      convertArabicBack(text: string): string;
    };
    ArabicShaper: {
      convertArabic(text: string): string;
      convertArabicBack(text: string): string;
    };
  };

  export default reshaper;
}
