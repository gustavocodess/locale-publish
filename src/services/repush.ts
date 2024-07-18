import appState from '@builder.io/app-context';
import { getLocaleFromPage, duplicateDefaultValuesToLocaleValues } from '../utils/locales';
import { mergeBlocks, getArrayStructureSnapshot, addUniqueIdsInBlocks } from "../utils/blocks";
import { pushBlocks, updateChildren } from "../locale-service";
import { debugMode } from "../utils/consts";

const fastClone = (obj: any) =>
  obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));

export async function repush(childId: string, privateKey: string, apiKey: string, modelName: string) {

  if (debugMode) console.log('Debug: Re-Push Scenario (Approach II)');
  try {

    const master = fastClone(appState?.designerState?.editingContentModel);
    let masterBlocks = JSON.parse(master?.data?.blocksString).filter((block: any) => !block?.id.includes('pixel'));

    const childResponse = await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${childId}?apiKey=${apiKey}&cachebust=true&includeUnpublished=true&cacheSeconds=1`);
    const child = await childResponse.json();
    const childBlocks = child?.data?.blocks?.filter((block: any) => !block?.id.includes('pixel'));
    const childLocale = getLocaleFromPage(child);

    const snapshot = child?.data?.blocks_masterSnapshot ? child?.data?.blocks_masterSnapshot : false;

    masterBlocks = addUniqueIdsInBlocks(masterBlocks);
    await pushBlocks(master?.id, modelName, masterBlocks, privateKey);

    let resultBlocks: any = mergeBlocks(masterBlocks, childBlocks, snapshot);
    resultBlocks = duplicateDefaultValuesToLocaleValues(resultBlocks, childLocale);

    if (debugMode) console.log('Debug: child', child);
    if (debugMode) console.log('Debug: childLocale', childLocale);
    if (debugMode) console.log('Debug: childBlocks', childBlocks);
    if (debugMode) console.log('Debug: masterBlocks', masterBlocks);
    if (debugMode) console.log('Debug: resultBlocks', resultBlocks);

    if (resultBlocks?.length === 0) {
      throw new Error('Error in repush: resultBlocks is undefined or null. Please try again');
    }

    const childData: any = { ...child?.data };
    childData.blocks_masterSnapshot = getArrayStructureSnapshot(masterBlocks);

    const result = await updateChildren(childId, privateKey, resultBlocks, modelName, childData);

    return result;

  } catch (error) {
    console.error('Error in repush function:', error);
    throw error;
  }
}
