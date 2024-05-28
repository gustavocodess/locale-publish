import { Builder, BuilderContent } from '@builder.io/react';
import * as React from 'react';
import {
  Language,
} from '@material-ui/icons';
import LocalesTab from './locales-tab';
import { Tooltip } from '@material-ui/core';
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
      <Tooltip title="Locales">
        <Language style={{ fontSize: 20, marginRight: 6 }} />
      </Tooltip>
    ),
    component: () => LocalesTab({privateKey}),
  })
}

export function getQueryLocales(content: any) {
  if (!content) return []
  const queries = fastClone(content ?? {})?.query?.filter((item: any) => item?.property === 'locale')
  const locales = queries.map((queryItem: any) => queryItem?.value.join())
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
    if (path[i] && obj[path[i]]) {
      obj = obj[path[i]];
    } else {
      // console.log('deepGet error: ', obj, newPath);
      return undefined;
    }
  };
  return obj;
};