import { BuilderElement } from "@builder.io/react";

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
        if (parent && propertyName && !propertyName.endsWith('_masterSnapshot') && propertyName !== 'uniqueId') {
          parent[`${propertyName}_masterSnapshot`] = btoa(JSON.stringify(updatedArray));
        }
        return updatedArray;
      } else if (typeof current === 'object' && current !== null) {
        let newObj: any = { ...current };
        for (const key in current) {
          if (current.hasOwnProperty(key) && key !== 'children' && !key.endsWith('_masterSnapshot') && key !== 'uniqueId') {
            newObj[key] = traverse(current[key], newObj, key);
          }
        }
        if (parent && propertyName && !propertyName.endsWith('_masterSnapshot') && propertyName !== 'uniqueId') {
          parent[`${propertyName}_masterSnapshot`] = btoa(JSON.stringify(newObj));
        }
        return newObj;
      } else if (parent && propertyName && !propertyName.endsWith('_masterSnapshot') && propertyName !== 'uniqueId') {
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
            if (obj.hasOwnProperty(key) && key !== 'children') {
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

          console.log('Debug: Processing element in list', masterItem.uniqueId);
          console.log('Debug: lastSnapshot', snapshot);
          console.log('Debug: lastMaster', lastMaster);

          if (!existsInLastMaster) {
            console.log('Debug: Unwanted scenario', masterItem.uniqueId);
            result.push(masterItem);
          }
        }
      });

      return result;
    };

    let mergedBlocks = master.map((masterBlock) => {
      const matchingChildBlock = child.find((childBlock) => childBlock.id === masterBlock.id);
      if (matchingChildBlock && matchingChildBlock.component && matchingChildBlock.component.options) {
        const mergedOptions = { ...matchingChildBlock.component.options };

        Object.keys(mergedOptions).forEach((key) => {
          if (Array.isArray(mergedOptions[key])) {
            const masterArray = masterBlock?.component?.options[key] || [];
            const snapshotKey = `${key}_masterSnapshot`;

            if (!matchingChildBlock?.component) return;
            const snapshot = matchingChildBlock.component.options[snapshotKey];
            mergedOptions[key] = mergeArrays(masterArray, mergedOptions[key], snapshot, snapshotKey);
          } else if (typeof mergedOptions[key] !== 'object' && typeof mergedOptions[key] !== 'undefined' && !Array.isArray(mergedOptions[key])) {
            const snapshotKey = `${key}_masterSnapshot`;
            const snapshot = matchingChildBlock?.component?.options[snapshotKey];

            if (snapshot) {
              const decodedSnapshot = JSON.parse(atob(snapshot));
              if (mergedOptions[key] === decodedSnapshot) {
                mergedOptions[key] = masterBlock?.component?.options[key];
              }
            }
          }
        });

        return {
          ...masterBlock,
          component: {
            ...masterBlock.component,
            options: mergedOptions,
          },
        } as BuilderElement;
      }
      return masterBlock;
    }) as BuilderElement[];

    child.forEach((childBlock) => {
      if (childBlock.component && childBlock.component.options) {
        if (!childBlock.component.options.uniqueId || masterMap.has(childBlock.component.options.uniqueId)) {
          if (!mergedBlocks.find((block) => block.id === childBlock.id)) {
            mergedBlocks.push(childBlock as BuilderElement);
          }
        }
      }
    });

    mergedBlocks = mergedBlocks.map((block) => {
      const matchingMasterBlock = master.find((masterBlock) => masterBlock.id === block.id);
      if (matchingMasterBlock && matchingMasterBlock.component && matchingMasterBlock.component.options) {
        if (block.component && block.component.options) {
          const updatedOptions = { ...block.component.options };
          Object.keys(updatedOptions).forEach((key) => {
            if (Array.isArray(updatedOptions[key])) {
              if (matchingMasterBlock.component) {
                const snapshotKey = `${key}_masterSnapshot`;
                const masterSnapshot = btoa(JSON.stringify(matchingMasterBlock.component.options[key]));
                updatedOptions[snapshotKey] = masterSnapshot;

                console.log(`Debug: new snapshot for ${key}`, masterSnapshot);
                console.log(`Debug: new snapshot json for ${key}`, matchingMasterBlock.component.options[key]);
              }
            } else if (typeof updatedOptions[key] !== 'object' && typeof updatedOptions[key] !== 'undefined' && !Array.isArray(updatedOptions[key])) {
              const snapshotKey = `${key}_masterSnapshot`;
              const snapshot = block?.component?.options[snapshotKey];

              if (snapshot) {
                const decodedSnapshot = JSON.parse(atob(snapshot));
                if (updatedOptions[key] === decodedSnapshot) {
                  updatedOptions[key] = matchingMasterBlock?.component?.options[key];
                }
              }
            }
          });

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
    }) as BuilderElement[];

    return mergedBlocks;
  } catch (error) {
    console.error('Error in mergeBlocks function:', error);
    return [];
  }
};
