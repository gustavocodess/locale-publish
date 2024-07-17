import { BuilderElement } from "@builder.io/react";

const excludedProperties = ['children', 'uniqueId', '@type', 'shouldTranslate'];

const mergeLocalizedValues = (masterValue: any, childValue: any): any => {
  if (typeof masterValue === 'object' && masterValue["@type"] === "@builder.io/core:LocalizedValue") {
    const updatedValue = { ...childValue };

    const decodedChildSnapshot = childValue.Default_masterSnapshot ? JSON.parse(atob(childValue.Default_masterSnapshot)) : null;

    if (masterValue.Default !== decodedChildSnapshot) {
      updatedValue.Default = masterValue.Default;
      Object.keys(childValue).forEach((key) => {
        if (key !== 'Default' && key !== 'Default_masterSnapshot' && key !== '@type') {
          updatedValue[key] = masterValue.Default;
        }
      });
    }

    return updatedValue;
  }
  return childValue;
};

const mergeLocalizedValuesInBlocks = (master: any, child: any): any => {
  const mergedObject = { ...child };

  Object.keys(child).forEach((key) => {
    if (typeof child[key] === 'object' && !Array.isArray(child[key]) && child[key] !== null) {
      if (master[key] && master[key]["@type"] === "@builder.io/core:LocalizedValue") {
        mergedObject[key] = mergeLocalizedValues(master[key], child[key]);
      } else {
        mergedObject[key] = mergeLocalizedValuesInBlocks(master[key] || {}, child[key]);
      }
    } else if (Array.isArray(child[key])) {
      mergedObject[key] = child[key].map((item: any, index: number) => {
        return mergeLocalizedValuesInBlocks(master[key]?.[index] || {}, item);
      });
    }
  });

  return mergedObject;
};

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
          const snapshotArray = updatedArray.map(item => ({ uniqueId: item.uniqueId }));
          parent[`${propertyName}_masterSnapshot`] = btoa(JSON.stringify(snapshotArray));
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



const correctComponentPositions = (masterBlocks: BuilderElement[], childBlocks: BuilderElement[], mergedBlocks: BuilderElement[]): BuilderElement[] => {

  const baseComponents: BuilderElement[] = [];

  mergedBlocks.forEach(block => {
    if (block.id && masterBlocks.some(mBlock => mBlock.id === block.id) && childBlocks.some(cBlock => cBlock.id === block.id)) {
      baseComponents.push(block);
    }
  });

  masterBlocks.forEach(block => {
    if (!baseComponents.some(baseBlock => baseBlock.id === block.id)) {
      const index = masterBlocks.findIndex(mBlock => mBlock.id === block.id);
      baseComponents.splice(index, 0, block);
    }
  });

  childBlocks.forEach(block => {
    if (!baseComponents.some(baseBlock => baseBlock.id === block.id)) {
      const index = childBlocks.findIndex(cBlock => cBlock.id === block.id);
      const nextChildBlock = childBlocks[index + 1];
      const prevChildBlock = childBlocks[index - 1];

      let insertIndex = baseComponents.length; // Default to end

      if (nextChildBlock) {
        const nextIndex = baseComponents.findIndex(baseBlock => baseBlock.id === nextChildBlock.id);
        if (nextIndex !== -1) {
          insertIndex = nextIndex;
        }
      } else if (prevChildBlock) {
        const prevIndex = baseComponents.findIndex(baseBlock => baseBlock.id === prevChildBlock.id);
        if (prevIndex !== -1) {
          insertIndex = prevIndex + 1;
        }
      }

      baseComponents.splice(insertIndex, 0, block);
    }
  });

  return baseComponents;
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

    let localizedMergedBlocks = child.map((childBlock) => {
      const matchingMasterBlock = master.find((masterBlock) => masterBlock.id === childBlock.id);
      if (matchingMasterBlock && matchingMasterBlock.component && matchingMasterBlock.component.options) {
        const mergedOptions = mergeLocalizedValuesInBlocks(matchingMasterBlock.component.options, childBlock?.component?.options);

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
      if (!localizedMergedBlocks.find((block) => block.id === masterBlock.id)) {
        localizedMergedBlocks.push(masterBlock as BuilderElement);
      }
    });

    const mergeArrays = (masterArray: any[], childArray: any[], snapshot: any, snapshotKey: string): any[] => {

      console.log('childArray',childArray);

      const childUniqueIds = new Set(childArray.map((childItem: any) => childItem.uniqueId));

      const result = childArray.map((childItem: any) => {
        if (childItem.uniqueId && masterMap.has(childItem.uniqueId)) {
          return childItem;
        }
        if (!childItem.uniqueId){
          return childItem;
        }
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
      console.log('result of merging',result);
      return result;
    };

    const mergeObjects = (masterObject: any, childObject: any): any => {

      console.log('trying to merge',childObject);
      const mergedObject = { ...childObject };

      Object.keys(childObject).forEach((key) => {
        if (Array.isArray(childObject[key])) {
          const masterArray = masterObject?.[key] || [];
          const snapshotKey = `${key}_masterSnapshot`;
          const snapshot = childObject[snapshotKey];
          mergedObject[key] = mergeArrays(masterArray, childObject[key], snapshot, snapshotKey);
          mergedObject[snapshotKey] = btoa(JSON.stringify(mergedObject[key]));
        } else if (typeof childObject[key] === 'object' && childObject[key] !== null) {
          const snapshotKey = `${key}_masterSnapshot`;
          const snapshot = childObject[snapshotKey];

          if (snapshot && masterObject[snapshotKey]) {
            if (childObject[snapshotKey] !== masterObject[snapshotKey]){
              if (childObject[key]["@type"]){
                if (childObject[key].Default !== masterObject[key].Default){
                  mergedObject[key] = masterObject[key];
                }
              }
            }else{
              mergedObject[key] = childObject[key];
            }
          }
        } else if (typeof childObject[key] !== 'undefined' && !Array.isArray(childObject[key]) && !key.endsWith('_masterSnapshot') && !excludedProperties.includes(key)) {
          const snapshotKey = `${key}_masterSnapshot`;
          const snapshot = childObject[snapshotKey];

          if (snapshot) {
            const decodedSnapshot = JSON.parse(atob(snapshot));
            if (masterObject[key] !== decodedSnapshot) {
              mergedObject[key] = masterObject?.[key];
              mergedObject[snapshotKey] = btoa(JSON.stringify(masterObject[key]));
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
              if (masterOptions?.[key]){
                newOptions[key] = masterOptions?.[key];
              }
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

    mergedBlocks = correctComponentPositions(master, child, mergedBlocks);

    return mergedBlocks;
  } catch (error) {
    console.error('Error in mergeBlocks function:', error);
    return [];
  }
};
