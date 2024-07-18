/*
Functions:

 Exported:
  addUniqueIdsInBlocks
  mergeBlocks

 Internal:
  mergeArrays
  mergeLocalizedValue
  mergeComponentOptions
  getArrayStructureSnapshot
  getId

 */

import { BuilderElement } from "@builder.io/react";
import { debugMode } from "./consts";

const excludedProperties = ['children', 'id', '@type', 'Default', 'shouldTranslate'];

const getUniqueId = (): string => {
  return 'id-' + Math.random().toString(36).substr(2, 16);
};

const getArrayStructureSnapshot = (fullArray: any[]): any => {
  const snapshotArray = fullArray.map(item => ({ id: item.id })) || [];
  return snapshotArray;
};

export const addUniqueIdsInBlocks = (obj: any): any => {
  const traverse = (current: any, parent: any = null, propertyName: string = ''): any => {
    try {
      if (Array.isArray(current)) {
        const updatedArray = current.map((item) => {
          if (typeof item === 'object' && item !== null) {
            if (!item.id) {
              item.id = getUniqueId();
            }
            return { ...item, ...traverse(item) };
          }
          return item;
        });
        return updatedArray;
      } else if (typeof current === 'object' && current !== null) {
        let newObj: any = { ...current };
        for (const key in current) {
          if (current.hasOwnProperty(key) && !key.endsWith('_masterSnapshot') && !excludedProperties.includes(key)) {
            newObj[key] = traverse(current[key], newObj, key);
          }
        }
        return newObj;
      }
      return current;
    } catch (error) {
      console.error('Error in unique Ids function:', error);
      return current;
    }
  };
  const addUniqueIdToComponent = (block: any): BuilderElement => {
    try {
      if (!block?.component?.options) {
        return block;
      }
      if (!block.component.options.id) {
        block.component.options.id = getUniqueId();
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

const mergeArrays = (masterArray: any[], childArray: any[], snapshot: any): any[] => {

  if (!masterArray || !childArray){
    return childArray;
  }

  let mergedArrays:any = [];

  if (debugMode) console.log('Debug: Merging, childArray',childArray);
  if (debugMode) console.log('Debug: With, masterArray',masterArray);

  // Child & Common Elements
  childArray.forEach((childItem: any) => {
    if (childItem && typeof childItem !== undefined){

      if (childItem.id && masterArray.some(item => item.id === childItem.id)) {
        if (debugMode) console.log(`Debug: Added item (available on master & child) ${childItem.id}`,childItem)
        mergedArrays.push(childItem);
      }
      if (!childItem.id || !masterArray.some(item => item.id === childItem.id)){
        if (debugMode) console.log('Debug: Added child element (created on child)',childItem)
        mergedArrays.push(childItem);
      }

      if (snapshot && childItem.id && !masterArray.some(item => item.id === childItem.id)){
        if (debugMode) console.log(`Debug: Removed old element ${childItem.id}`,childItem)
        mergedArrays = mergedArrays.filter((item: { id: any; }) => item.id !== childItem.id);
      }

    }

  });

  masterArray.forEach((masterItem: any) => {
    if (masterItem && typeof masterItem !== undefined){
      if (masterItem.id && !childArray.some(item => item.id === masterItem.id)) {
        if (snapshot) {
          if (!snapshot.some((item: { id: any; }) => item.id === masterItem.id)){
            if (debugMode) console.log('Debug: Added new Element to List',masterItem)
            mergedArrays.push(masterItem);
          }
        }else{
          if (debugMode) console.log('Debug: Added new Element to List',masterItem)
          mergedArrays.push(masterItem);
        }
      }
    }

  });

  if(debugMode) console.log('Debug: Arrays after merging',mergedArrays);
  return mergedArrays;
};

const mergeLocalizedValue = (masterOption: any, option: any): any => {
  if (debugMode) console.log('Debug: Merging localizedValue, masterOption',masterOption);
  if (debugMode) console.log('Debug: With localizedValue option',option);
  if (typeof option === 'object' && option["@type"] === "@builder.io/core:LocalizedValue") {
    if (masterOption?.Default !== option?.Default) {
      return masterOption;
    }else{
      return option;
    }
  }
  return option;
};

const mergeComponentOptions = (masterOptions: any, options: any): any => {

  if (options && masterOptions){
    Object.keys(options).forEach((key) => {

      if (options[key] === 'undefined' || typeof options[key] === "undefined" || options[key] === null ||
        key.endsWith('_masterSnapshot') || excludedProperties.includes(key) ||
        masterOptions[key] === 'undefined' || typeof masterOptions[key] === "undefined" || masterOptions[key] === null
      ) return;

      if (Array.isArray(options[key])) {

        const snapshotKey = `${key}_masterSnapshot`;
        const snapshot = options[snapshotKey];

        options[key] = mergeArrays(masterOptions[key], options[key], snapshot);
        options[snapshotKey] = getArrayStructureSnapshot(masterOptions[key]);

        options[key].forEach((element:any) => {
          if (debugMode) console.log(`Debug: Traversing element ${key}`,element);
            const masterOptionsById = masterOptions[key].find((item: { id: any; }) =>
              item.id === element?.id
            );
            if (masterOptionsById){
              if (debugMode) console.log('Debug: Join traverse with corresponding master element',masterOptionsById);
              options[key][element] = mergeComponentOptions(masterOptionsById, element);
            }else{
              if (debugMode) console.log('Debug: Skipping traverse, no correlated master');
            }
        });

      }else if(typeof options[key] === 'object'){

        if (options[key] && options[key]["@type"] === "@builder.io/core:LocalizedValue") {
          if (masterOptions[key]){
            options[key] = mergeLocalizedValue(masterOptions[key], options[key]);
          }
        }else{
          options[key] = mergeComponentOptions(masterOptions[key], options[key]);
        }

      }else {

        const snapshotKey = `${key}_masterSnapshot`;
        if (debugMode) console.log(`Debug: Merging ${key}`, options[snapshotKey]);

        if (!options[snapshotKey] || masterOptions[key] !== options[snapshotKey]){
          if (debugMode) console.log(`Debug: Updating ${key}`,masterOptions[key]);
          options[key] = masterOptions[key];
          options[snapshotKey]= masterOptions[key]
        }
      }

    });
  }

  return options;
};

export const mergeBlocks = (master: BuilderElement[], child: BuilderElement[]): BuilderElement[] => {
  try {
    let mergedBlocks = mergeArrays(master,child,false);

    mergedBlocks = mergedBlocks.map((mergedBlock) => {
      const matchingMasterBlock = master.find((masterBlock) => masterBlock.id === mergedBlock.id);
      if (matchingMasterBlock) {

        const mergedOptions = mergeComponentOptions(matchingMasterBlock.component?.options, mergedBlock?.component?.options);
        return {
          ...mergedBlock,
          component: {
            ...mergedBlock.component,
            options: mergedOptions,
          },
        } as BuilderElement;

      }
      return mergedBlock;
    });
    return mergedBlocks;
  } catch (error) {
    console.error('Error in mergeBlocks function:', error);
    return [];
  }
};
