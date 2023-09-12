import { registerCommercePlugin as registerPlugin } from '@builder.io/commerce-plugin-tools';
import pkg from '../package.json';
import appState from '@builder.io/app-context';

import {
  registerContentAction,
  registerContextMenuAction,
  fastClone,
  registerEditorOnLoad,
} from './plugin-helpers';

registerPlugin(
  {
    name: 'Publish for Locale',
    id: pkg.name,
    settings: [
      {
        name: 'private key',
        type: 'string',
      },
    ],
    ctaText: `Connect your localization plugin`,
    noPreviewTypes: true,
  },
  async settings => {

    registerEditorOnLoad(({ safeReaction }) => {
      safeReaction(
        () => {
          return true;
        },
        async shoudlCheck => {
          if (!shoudlCheck) {
            return;
          }
          
        },
        {
          fireImmediately: true,
        }
      );
    });

    const transcludedMetaKey = 'excludeFromTranslation';
    registerContextMenuAction({
      label: 'Exclude from future translations',
      showIf(selectedElements) {
        if (selectedElements.length !== 1) {
          // todo maybe apply for multiple
          return false;
        }
        const element = selectedElements[0];
        const isExcluded = element.meta?.get(transcludedMetaKey);
        return !isExcluded;
      },
      onClick(elements) {
        elements.forEach(el => el.meta.set('excludeFromTranslation', true));
      },
    });

    registerContextMenuAction({
      label: 'Include in future translations',
      showIf(selectedElements) {
        if (selectedElements.length !== 1) {
          // todo maybe apply for multiple
          return false;
        }
        const element = selectedElements[0];
        const isExcluded = element.meta?.get(transcludedMetaKey);
        return isExcluded;
      },
      onClick(elements) {
        elements.forEach(el => el.meta.set('excludeFromTranslation', false));
      },
    });

    registerContentAction({
      label: `Publish for locale`,
      showIf(content, model) {
        return true;
      },
      async onClick(content) {
        const locale = appState.designerState?.activeLocale || 'Default';
        const model = content.modelName;
        const contentId = content.id;

        const draftContent = fastClone(content);
        const liveContent = (await fetch(`https://cdn.builder.io/api/v3/content/${model}/${content.id}?apiKey=${appState.user.apiKey}&staleCacheSeconds=1`).then(res => res.json()));

        const draftBlocks = JSON.parse(draftContent?.data?.blocksString);


        const liveContentBlockIds = liveContent?.data?.blocks.map(bl => bl.id);

        const blocksToPush = []
        draftBlocks.forEach(block => {
          console.log('block.id', block.id, typeof block.id)
          if (liveContentBlockIds.indexOf(block.id) < 0) {
            blocksToPush.push({
              ...block,
              bindings: {
                ...block.bindings,
                show: `var _virtual_index=\"${locale}\"===state.locale;return _virtual_index`
              }
            });
          } else {
            blocksToPush.push(block);
          }
        })
        
        const newContent = {
          data: {
            blocks: blocksToPush,
          }
        }

        appState.globalState.showGlobalBlockingLoading(`Publishing for ${locale} ....`);
        const resultStatus = await fetch(
          `https://builder.io/api/v1/write/${model}/${contentId}?apiKey=${appState.user.apiKey}&cachebust=true`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              // 'Authorization': `Bearer bpk-eef5ff6388eb40fdb999c49fcb69514b`
              // 'Authorization': `Bearer bpk-7a4e1daa16854d78a510e2eedabc06c2`
              // 'Authorization': `Bearer bpk-ef4d429d8b054bc186d31aee47df2273`
              // TODO: add your private key here
              'Authorization': `Bearer TODO: add your private key here`
            },
            body: JSON.stringify(newContent),
          }
        ).then(res => res.status);

        if (resultStatus === 200) {
          appState.snackBar.show(`Published content for ${locale}.`);
        } else {
          appState.snackBar.show(`Error publishing for ${locale}. Contact Admin.`);
        }
        appState.globalState.hideGlobalBlockingLoading();
        }
      },
    );

    return {};
  }
);


