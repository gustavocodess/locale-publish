import { registerCommercePlugin as registerPlugin } from '@builder.io/commerce-plugin-tools';
import { reaction } from 'mobx'
import { Builder } from '@builder.io/sdk';
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
        name: 'privateKey',
        type: 'string',
        required: true,
      },
    ],
    ctaText: `Connect your localization plugin`,
    noPreviewTypes: true,
  },
  async settings => {
    const privateKey = settings.get('privateKey');
    console.log('privateKey ', privateKey)
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
        const locale = appState.designerState?.activeLocale || 'Default';
        return locale !== 'Default';
      },
      async onClick(content) {
        const locale = appState.designerState?.activeLocale || 'Default';
        const model = content.modelName;
        const contentId = content.id;

        const draftContent = fastClone(content);
        const liveContent = (await fetch(`https://cdn.builder.io/api/v3/content/${model}/${content.id}?apiKey=${appState.user.apiKey}&staleCacheSeconds=1`).then(res => res.json()));

        const draftBlocks = JSON.parse(draftContent?.data?.blocksString);

        let liveContentBlockIds = []
        // verify if has content live, if not, just publish the draft content
        // if has content live, just append blocks with hide if condition
        if (liveContent?.published === 'published') {
          liveContentBlockIds = liveContent?.data?.blocks.map(bl => bl.id);
        } else {
          liveContentBlockIds = draftBlocks.map(bl => bl.id);
        }

        const blocksToPush = []
        draftBlocks.forEach(block => {
          if (liveContentBlockIds.indexOf(block.id) < 0 // case block is not in live content
          || liveContent?.published === 'draft' // case there is no live content
          ) {
            blocksToPush.push({
              ...block,
              bindings: {
                ...block.bindings,
                show: `var _virtual_index=\"${locale}\"===state.locale;return _virtual_index`
              },
              component: {
                ...block.component,
                options: {
                  ...block.component.options,
                  show: true,
                }
              }
            });
          } else {
            blocksToPush.push(block);
          }
        })
        
        const newContent = {
          data: {
            blocks: blocksToPush,
          },
          published: "published",
        }

        appState.globalState.showGlobalBlockingLoading(`Publishing for ${locale} ....`);
        const resultStatus = await fetch(
          `https://builder.io/api/v1/write/${model}/${contentId}?apiKey=${appState.user.apiKey}&cachebust=true`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${privateKey}`
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
