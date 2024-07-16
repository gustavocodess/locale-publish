import { BuilderElement } from "@builder.io/react";

const excludedProperties = ['children', 'uniqueId', '@type', 'Default', 'shouldTranslate'];

const generateUniqueId = (): string => {
  return 'id-' + Math.random().toString(36).substr(2, 16);
};

export const addUniqueIdsInBlocks = (obj: any): any => {
  const traverse = (current: any, parent: any = null, propertyName: string = ''): any => {
    try {
      if (Array.isArray(current)) {
        const updatedArray = current.map((item) => {
          if (typeof item === 'object' && item !== null) {
            if (!item.uniqueId) {
              item.uniqueId = generateUniqueId();
            }
            return { ...item, ...traverse(item) };
          }
          return item;
        });
        if (parent && propertyName && !propertyName.endsWith('_masterSnapshot') && !excludedProperties.includes(propertyName)) {
          parent[`${propertyName}_masterSnapshot`] = btoa(JSON.stringify(updatedArray));
        }
        return updatedArray;
      } else if (typeof current === 'object' && current !== null) {
        let newObj: any = { ...current };
        for (const key in current) {
          if (current.hasOwnProperty(key) && !key.endsWith('_masterSnapshot') && !excludedProperties.includes(key)) {
            newObj[key] = traverse(current[key], newObj, key);
          }
        }
        if (parent && propertyName && !propertyName.endsWith('_masterSnapshot') && !excludedProperties.includes(propertyName)) {
          parent[`${propertyName}_masterSnapshot`] = btoa(JSON.stringify(newObj));
        }
        return newObj;
      } else if (parent && propertyName && !propertyName.endsWith('_masterSnapshot') && !excludedProperties.includes(propertyName)) {
        parent[`${propertyName}_masterSnapshot`] = btoa(JSON.stringify(current));
      }
      return current;
    } catch (error) {
      console.error('Error in traverse function:', error);
      return current;
    }
  };

  const addUniqueIdToComponent = (block: BuilderElement): BuilderElement => {
    try {
      if (!block?.component?.options) {
        return block;
      }
      if (!block.component.options.uniqueId) {
        block.component.options.uniqueId = generateUniqueId();
      }
      block.component.options = traverse(block.component.options);
      return block;
    } catch (error) {
      console.error('Error in addUniqueIdToComponent function:', error);
      return block;
    }
  };

  try {
    if (Array.isArray(obj)) {
      return obj.map(addUniqueIdToComponent) as BuilderElement[];
    } else {
      return addUniqueIdToComponent(obj);
    }
  } catch (error) {
    console.error('Error in addUniqueIdsInBlocks function:', error);
    return obj;
  }
};

export const mergeBlocks = (master: BuilderElement[], child: BuilderElement[]): BuilderElement[] => {
  const masterMap = new Map<string, any>();

  try {
    master.forEach((masterBlock) => {
      if (!masterBlock?.component?.options) {
        return;
      }

      if (masterBlock.component.options.uniqueId) {
        masterMap.set(masterBlock.component.options.uniqueId, masterBlock);
      }

      const flattenAndMap = (obj: any) => {
        if (Array.isArray(obj)) {
          obj.forEach((item) => {
            if (item.uniqueId) {
              masterMap.set(item.uniqueId, item);
            }
            flattenAndMap(item);
          });
        } else if (typeof obj === 'object' && obj !== null) {
          for (const key in obj) {
            if (obj.hasOwnProperty(key) && !key.endsWith('_masterSnapshot') && !excludedProperties.includes(key)) {
              flattenAndMap(obj[key]);
            }
          }
        }
      };

      flattenAndMap(masterBlock.component.options);
    });

    const mergeArrays = (masterArray: any[], childArray: any[], snapshot: any, snapshotKey: string): any[] => {
      const childUniqueIds = new Set(childArray.map((childItem: any) => childItem.uniqueId));

      const result = childArray.map((childItem: any) => {
        if (childItem.uniqueId && masterMap.has(childItem.uniqueId)) {
          return {
            ...masterMap.get(childItem.uniqueId),
            ...childItem,
          };
        }
        return childItem;
      });

      masterArray.forEach((masterItem: any) => {
        if (masterItem.uniqueId && !childUniqueIds.has(masterItem.uniqueId)) {
          const lastMaster = snapshot ? JSON.parse(atob(snapshot)) : [];
          const existsInLastMaster = lastMaster.some((snapshotItem: any) => snapshotItem.uniqueId === masterItem.uniqueId);

          if (!existsInLastMaster) {
            result.push(masterItem);
          }
        }
      });

      return result;
    };

    const mergeObjects = (masterObject: any, childObject: any): any => {
      const mergedObject = { ...childObject };

      Object.keys(childObject).forEach((key) => {
        if (Array.isArray(childObject[key])) {
          const masterArray = masterObject?.[key] || [];
          const snapshotKey = `${key}_masterSnapshot`;
          const snapshot = childObject[snapshotKey];
          mergedObject[key] = mergeArrays(masterArray, childObject[key], snapshot, snapshotKey);
        } else if (typeof childObject[key] === 'object' && childObject[key] !== null) {
          const snapshotKey = `${key}_masterSnapshot`;
          const snapshot = childObject[snapshotKey];
          if (snapshot) {
            const decodedSnapshot = JSON.parse(atob(snapshot));
            if (JSON.stringify(childObject[key]) === JSON.stringify(decodedSnapshot)) {
              mergedObject[key] = masterObject?.[key];
            } else {
              mergedObject[key] = mergeObjects(masterObject?.[key] || {}, childObject[key]);
            }
          } else {
            mergedObject[key] = mergeObjects(masterObject?.[key] || {}, childObject[key]);
          }
        } else if (typeof childObject[key] !== 'undefined' && !Array.isArray(childObject[key]) && !key.endsWith('_masterSnapshot') && !excludedProperties.includes(key)) {
          const snapshotKey = `${key}_masterSnapshot`;
          const snapshot = childObject[snapshotKey];

          if (snapshot) {
            const decodedSnapshot = JSON.parse(atob(snapshot));
            if (childObject[key] === decodedSnapshot) {
              mergedObject[key] = masterObject?.[key];
            }
          }
        }
      });

      return mergedObject;
    };

    let mergedBlocks = child.map((childBlock) => {
      const matchingMasterBlock = master.find((masterBlock) => masterBlock.id === childBlock.id);
      if (matchingMasterBlock && matchingMasterBlock.component && matchingMasterBlock.component.options) {
        const mergedOptions = mergeObjects(matchingMasterBlock.component.options, childBlock?.component?.options);

        return {
          ...childBlock,
          component: {
            ...childBlock.component,
            options: mergedOptions,
          },
        } as BuilderElement;
      }
      return childBlock;
    });

    master.forEach((masterBlock) => {
      if (!mergedBlocks.find((block) => block.id === masterBlock.id)) {
        mergedBlocks.push(masterBlock as BuilderElement);
      }
    });

    const updateOptionsWithSnapshots = (updatedOptions: any, masterOptions: any): any => {
      const newOptions = { ...updatedOptions };

      Object.keys(newOptions).forEach((key) => {
        const snapshotKey = `${key}_masterSnapshot`;
        const snapshot = newOptions[snapshotKey];

        if (Array.isArray(newOptions[key])) {
          newOptions[key] = newOptions[key].map((item: any, index: number) => {
            if (typeof item === 'object' && item !== null) {
              return updateOptionsWithSnapshots(item, masterOptions?.[key]?.[index]);
            }
            return item;
          });

          const masterSnapshot = btoa(JSON.stringify(masterOptions?.[key]));
          newOptions[snapshotKey] = masterSnapshot;

        } else if (typeof newOptions[key] === 'object' && newOptions[key] !== null) {
          if (snapshot) {
            const decodedSnapshot = JSON.parse(atob(snapshot));
            if (JSON.stringify(newOptions[key]) === JSON.stringify(decodedSnapshot)) {
              newOptions[key] = masterOptions?.[key];
            } else {
              newOptions[key] = updateOptionsWithSnapshots(newOptions[key], masterOptions?.[key]);
            }
          } else {
            newOptions[key] = updateOptionsWithSnapshots(newOptions[key], masterOptions?.[key]);
          }

        } else if (!key.endsWith('_masterSnapshot') && !excludedProperties.includes(key)) {
          if (snapshot) {
            const decodedSnapshot = JSON.parse(atob(snapshot));
            if (newOptions[key] === decodedSnapshot) {
              newOptions[key] = masterOptions?.[key];
            }
          }

          if (masterOptions && masterOptions.hasOwnProperty(key)) {
            newOptions[snapshotKey] = btoa(JSON.stringify(masterOptions[key]));
          }
        }
      });

      return newOptions;
    };

    mergedBlocks = mergedBlocks.map((block) => {
      const matchingMasterBlock = master.find((masterBlock) => masterBlock.id === block.id);
      if (matchingMasterBlock && matchingMasterBlock.component && matchingMasterBlock.component.options) {
        if (block.component && block.component.options) {
          const updatedOptions = updateOptionsWithSnapshots({ ...block.component.options }, matchingMasterBlock.component.options);

          return {
            ...block,
            component: {
              ...block.component,
              options: updatedOptions,
            },
          } as BuilderElement;
        }
      }
      return block;
    });

    return mergedBlocks;
  } catch (error) {
    console.error('Error in mergeBlocks function:', error);
    return [];
  }
};