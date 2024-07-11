import { updateChildren } from "./locale-service";
import { fastClone } from "./plugin-helpers";
import appState from '@builder.io/app-context';


export async function repushSingleLocaleTomasz(childId:string, privateKey:string, apiKey: string, modelName: string) {
  const master = fastClone(appState?.designerState?.editingContentModel);
  const child = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${childId}?apiKey=${apiKey}&cachebust=true&includeUnpublished=true&cacheSeconds=1`)).json();
  const masterBlocks = JSON.parse(master?.data?.blocksString).filter((block:any) => !block?.id.includes('pixel'));
  const childBlocks = child?.data?.blocks?.filter((block:any) => !block?.id.includes('pixel'));
  const resultBlocks:any = [];
  const findChildBlockById = (id:any) => childBlocks.find((block:any) => block.id === id);
  masterBlocks.forEach((masterBlock:any) => {
    const childBlock = findChildBlockById(masterBlock.id);
    if (childBlock) {
      const mergedBlock = { ...masterBlock, ...childBlock };
      mergedBlock.component.options = { ...masterBlock.component.options, ...childBlock.component.options };
      Object.keys(masterBlock.component.options).forEach((key) => {
        if (masterBlock.component.options[key]?.['@type'] === '@builder.io/core:LocalizedValue') {
          mergedBlock.component.options[key] = {
 ...masterBlock.component.options[key],
 ...childBlock.component.options[key]
 };
 } else {
          mergedBlock.component.options[key] = masterBlock.component.options[key];
 }
 });
      resultBlocks.push(mergedBlock);
 } else {
      resultBlocks.push(masterBlock);
 }
 });
  childBlocks.forEach((childBlock:any) => {
    if (!masterBlocks.some((block:any) => block.id === childBlock.id)) {
      resultBlocks.push(childBlock);
 }
 });
  const finalDataFields: any = {...child?.data}
  const result = await updateChildren(childId, privateKey, resultBlocks, modelName, finalDataFields)
  return result;
}