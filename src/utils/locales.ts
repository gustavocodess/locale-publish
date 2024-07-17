export const duplicateDefaultValuesToLocaleValues = (blocks: any[], locale: string): any[] => {
  const defaultLocale = 'Default';

  const traverseOptions = (options: any) => {
    for (const key in options) {
      if (options.hasOwnProperty(key)) {
        const value = options[key];
        if (value && typeof value === 'object' && value["@type"] === "@builder.io/core:LocalizedValue") {
          if (!value[locale] && value[defaultLocale]) {
            value[locale] = value[defaultLocale];
            console.log(`Set ${locale} value to ${defaultLocale} value for key: ${key}`);
          }
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          traverseOptions(value);
        } else if (Array.isArray(value)) {
          value.forEach(item => {
            if (typeof item === 'object') {
              traverseOptions(item);
            }
          });
        }
      }
    }
  };

  return blocks.map(block => {
    if (block.component && block.component.options) {
      traverseOptions(block.component.options);
    }
    return block;
  });
};

export const getLocaleFromPage = (page: any): string => {
  const localeQuery = page.query.find((q: any) => q.property === "locale");
  return localeQuery ? localeQuery.value[0] : null;
};