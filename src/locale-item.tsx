import { IconButton, Tooltip, Typography, Divider } from '@material-ui/core';
import { RemoveRedEye, Publish, Language, Code, SettingsRemote, CallMerge } from '@material-ui/icons';
import React from 'react';
interface Props {
  item: {
    // reference: {
    //   "@type": string;
    //   model: string;
    //   id: string;
    // }
    referenceId: string;
    name: string;
    target: {
      "@type": string;
      property: string;
      value: string[];
    }
  }
  onPush: (childrenId: string) => void;
  onPush2: (childrenId: string) => void;
  onForcePush: (childrenId: string) => void;
}

const LocaleItem = (props: Props) => {
  const { item, onPush, onPush2, onForcePush } = props
  if (!item || !item?.referenceId) return null

  return (
    <div style={{ margin: 8 }} key={`item-${item?.referenceId}`}>
      <Divider />
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Typography style={{ fontSize: 16 }}>
          {item.name}
        </Typography>
        <Typography style={{ fontSize: 13, fontWeight: 'bold' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Language style={{ opacity: 0.5, fontSize: 14, marginRight: 6 }} /> {item?.target?.value[0]}
          </div>
        </Typography>

      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
        <div>
          <Tooltip enterDelay={100} title="View local page" placement="left">
            <IconButton
              css={{ position: 'absolute', top: 0, right: 0 }}
              onClick={() => window.open(`https://builder.io/content/${item?.referenceId}`, '_blank')}
            >
            <RemoveRedEye css={{ opacity: 0.7, fontSize: 20 }} />
          </IconButton>
          </Tooltip>
          <Tooltip enterDelay={100} title="Push for locale" placement="left">
            <IconButton
              css={{ position: 'absolute', top: 0, right: 0 }}
              onClick={() =>  onPush(item?.referenceId)}
            >
              <Publish css={{ opacity: 0.7, fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          <Tooltip enterDelay={100} title="Re-Push for locale (merge)" placement="left">
            <IconButton
              css={{ position: 'absolute', top: 0, right: 0 }}
              onClick={() =>  onPush2(item?.referenceId)}
            >
              <CallMerge css={{ opacity: 0.7, fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </div>

        <Tooltip enterDelay={100} title="Force Re-Push" placement="left">
          <IconButton
            css={{ position: 'absolute', top: 0, right: 0 }}
            onClick={() =>  onForcePush(item?.referenceId)}
          >
            <SettingsRemote css={{ opacity: 0.7, fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        {/* <Tooltip enterDelay={100} title="Compare content" placement="left">
          <IconButton
            css={{ position: 'absolute', top: 0, right: 0 }}
            onClick={() =>  {}}
          >
            <Code css={{ opacity: 0.7, fontSize: 20 }} />
          </IconButton>
        </Tooltip> */}
        
      </div>
    </div>
  );
}

export default LocaleItem;