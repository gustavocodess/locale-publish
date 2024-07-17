import appState from '@builder.io/app-context';

import { getLocaleFromPage, duplicateDefaultValuesToLocaleValues } from '../utils/locales';
import { addUniqueIdsInBlocks, mergeBlocks } from "../utils/blocks";

import { pushBlocks, updateChildren } from "../locale-service";


const fastClone = (obj: any) =>
  obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));

export async function repush(childId: string, privateKey: string, apiKey: string, modelName: string) {

  console.log('Debug: Re-Push Scenario (Approach II), v207');

  try {

    const master = fastClone(appState?.designerState?.editingContentModel);
    let masterBlocks = JSON.parse(master?.data?.blocksString).filter((block: any) => !block?.id.includes('pixel'));

    const childResponse = await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${childId}?apiKey=${apiKey}&cachebust=true&includeUnpublished=true&cacheSeconds=1`);
    const child = await childResponse.json();
    const childBlocks = child?.data?.blocks?.filter((block: any) => !block?.id.includes('pixel'));

    masterBlocks = addUniqueIdsInBlocks(masterBlocks);
    await pushBlocks(master?.id, modelName, masterBlocks, privateKey);
    let resultBlocks: any = mergeBlocks(masterBlocks, childBlocks);

    const childLocale = getLocaleFromPage(child);
    resultBlocks = duplicateDefaultValuesToLocaleValues(resultBlocks, childLocale);

    console.log('Debug: child', child);
    console.log('Debug: childLocale', childLocale);
    console.log('Debug: childBlocks', childBlocks);
    console.log('Debug: masterBlocks', masterBlocks);
    console.log('Debug: resultBlocks', resultBlocks);

    const childData: any = { ...child?.data };
    const result = await updateChildren(childId, privateKey, resultBlocks, modelName, childData);

    return result;

  } catch (error) {
    console.error('Error in repush function:', error);
    throw error;
  }
}
