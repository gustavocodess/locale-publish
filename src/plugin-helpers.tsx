import { Builder, BuilderContent } from '@builder.io/react';
import React from 'react'
import {
  Language,
} from '@material-ui/icons';
import LocalesTab from './locales-tab';
import Tooltip from '@material-ui/core/Tooltip';
import traverse from 'traverse';
import { BuilderBlock } from '@builder.io/react/dist/types/src/components/builder-block.component';
import { set, unset } from 'lodash';


export type BulkAction = {
  label: string;
  showIf(selectedContentIds: string[], content: any[], model: any): Boolean;
  onClick(
    actions: { refreshList: () => void },
    selectedContentIds: string[],
    content: any[],
    model: any
  ): Promise<void>;
};

export function registerBulkAction(bulkAction: BulkAction) {
  Builder.register('content.bulkAction', bulkAction);
}

export type ContentAction = {
  label: string;
  showIf(content: any, model: any): Boolean;
  onClick(content: any): Promise<void>;
};

export function registerContentAction(contentAction: ContentAction) {
  Builder.register('content.action', contentAction);
}

export type ContextMenuAction = {
  label: string;
  showIf(elements: any[], model: any): Boolean;
  onClick(element: any[], model: any): void;
};

export function registerContextMenuAction(contextMenuAction: ContextMenuAction) {
  Builder.register('contextMenu.action', contextMenuAction);
}

export function registerEditorOnLoad(reactionCallback: (actions: ContentEditorActions) => void) {
  Builder.register('editor.onLoad', reactionCallback);
}

export function registerLocalesTab(privateKey: string) {
  Builder.register('editor.editTab', {
    name: (
      // @ts-ignore next-line
      <Tooltip title="Locales">
        {/* @ts-ignore next-line */}
        <Language style={{ fontSize: 20, marginRight: 6 }} />
      </Tooltip>
    ),
    component: () => LocalesTab({privateKey}),
  })
}

export function getQueryLocales(content: any) {
  if (!content) return []
  const queries = fastClone(content ?? {})?.query?.filter((item: any) => item?.property === 'locale')
  const locales = queries.map((queryItem: any) => queryItem?.value?.join())
  if (!locales.length) return []

  return locales.join()?.split(",")
}

interface ContentEditorActions {
  updatePreviewUrl: (url: string) => void;
  safeReaction<T>(
    watchFunction: () => T,
    reactionFunction: (arg: T) => void,
    options?: {
      fireImmediately: true;
    }
  ): void;
}

export interface CustomReactEditorProps<T = any> {
  value?: T;
  onChange(val: T | undefined): void;
  context: any;
  field?: any;
  renderEditor(options: {
    fields: any[];
    object: any;
    onChange?: (options: any) => any;
  }): React.ReactElement;
}

export const fastClone = (obj: any) =>
  obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));


export const deepGet = (obj: any, newPath: string) => {
  for (let i = 0, path = newPath.split('.'), len=path.length; i<len; i++){
    if (path[i] && obj[path[i]] !== undefined) {
      obj = obj[path[i]];
    } else {
      // console.log('deepGet error: ', obj, newPath);
      return undefined;
    }
  };
  return obj;
};

function isObject(obj: any) {
  return typeof obj === 'object' && obj !== null
}

export const deepSet = (obj: any, path: string, value: any, create: boolean) => {
  let properties = path.split('.')
  let currentObject = obj
  let property: string | undefined

  create = create === undefined ? true : create

  while (properties.length) {
    property = properties.shift()
    
    if (!currentObject) break;
    
    if (!isObject(currentObject[property!]) && create) {
      currentObject[property!] = {}
    }

    if (!properties.length){
      currentObject[property!] = value
    }
    currentObject = currentObject[property!]
  }

  return obj
}


export function localizeBlocks(masterBlocks: any[], locale: string, isRepush: boolean, childrenTranlationsMap?: any) {
  const newBlocks:any[] =  []
  masterBlocks.forEach((block: BuilderBlock) => {
    // @ts-ignore next-line
    delete block.responsiveStyles
    // @ts-ignore next-line
    delete block.meta

  traverse(block).map(function () {
    const path = this.path.join('.')
    if (isRepush) {
      if (path.endsWith('Default') && Boolean(childrenTranlationsMap[replaceAll(path, '.Default', `.${locale}`)])) {
        const valueToTranslate = deepGet(block, path)
        // deepSet(block, path.replace('Default', locale), valueToTranslate, true)
        deepSet(block, this.path.slice(0, -1).join('.') + `.${locale}`,valueToTranslate, true)
      } else if (
        path.endsWith('Default')
        && childrenTranlationsMap[block?.id +'.' + replaceAll(path, '.Default', `.${locale}`)] === undefined) {
        // deepSet(block, path, null, true)
        unset(block, path)
      } 
    } else {
      // works for first push and force push
      if (path.endsWith('Default')) {
        const valueToTranslate = deepGet(block, path)
        deepSet(block, this.path.slice(0, -1).join('.') + `.${locale}`,valueToTranslate, true)
      }
    }
  })
    newBlocks.push(block)
  })

  return newBlocks;
}

export function localizeDataFromMaster(masterData: BuilderContent, locale: string) {
  const newData = {...masterData}
  // @ts-ignore next-line
  delete newData.blocksString
  // @ts-ignore next-line
  delete newData.blocks
  // @ts-ignore next-line
  delete newData.meta

  traverse(newData).map(function () {
    const path = this.path.join('.') 
    if (path.endsWith('Default')) {
      const valueToTranslate = deepGet(newData, path)
      deepSet(newData, path.replace('Default', locale), valueToTranslate, true)
    }
  })
  return newData;
}

export function tagMasterBlockOptions(block: BuilderBlock) {
  const newBlock = {...block}
  traverse(newBlock).map(function () {
    const currentPath = this.path.join('.')
    const pathAbove = this.path.slice(0, -1)
    if (
      pathAbove.join('.').endsWith('Default')
      && !deepGet(newBlock, currentPath + '.gm_tag')
      && typeof this.node === 'object'
      // ! why does not work?
      //  && !this.node?.gm_tag
      ) {
        // && typeof this.node === 'object'
      // && !deepGet(newBlock, currentPath + '.gm_tag') 
      deepSet(newBlock, currentPath + '.gm_tag', `_GL-${crypto.randomUUID()}`, true)
      // ! why does not work?
      // this.node = {
      //   ...this.node,
      //   gm_tag: `_GL-${crypto.randomUUID()}`
      // }
    }
  })
  // console.log('tagged block ', newBlock)
  return newBlock;
}

export const clearBlock = (block: any, childrenBlocks: any, locale: string) => {
  const childrensMap: Record<string, any> = {}
  childrenBlocks.forEach((child: BuilderBlock) => {
    // @ts-ignore next-line
    childrensMap[child.id] = child
  })
  let newBlock = {...block}
  traverse(newBlock).map(function () {
    const path = this.path.join('.')
    const pathAbove = this.path.slice(0, -1).join('.')
    if (this.node === null
      || this.node === undefined
      || (
        (pathAbove.endsWith('Default'))
        && typeof this.node === 'object'
        && (childrensMap[block.id] && deepGet(childrensMap[block.id], replaceAll(path, '.Default', `.${locale}`)) === undefined)
      )
    ) {
      const lastKey = Number(path.split('.').pop())
      if (typeof lastKey === 'number') {
        // it means its an array
        const localPath = replaceAll(path, '.Default', `.${locale}`)
        if (deepGet(newBlock, localPath)) {
          const arrayPath = localPath.split('.').slice(0, -1).join('.')
          const newArray = [...deepGet(newBlock, arrayPath)]
          newArray.splice(lastKey, 1)
          deepSet(newBlock, arrayPath, newArray, true)
        }
      } else {
        unset(newBlock, replaceAll(path, '.Default', `.${locale}`))
      }
    }
  })
  return newBlock;
}

export const replaceAll = (str: string, find: string, replace: string) => {
  return str.replace(new RegExp(find, 'g'), replace)
}
