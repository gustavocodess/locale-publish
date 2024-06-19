import React from 'react';
import { TextFormat } from '@material-ui/icons';
import { IconButton, Tooltip } from '@material-ui/core';
import { countWords } from '../locale-helpers';

function WordsCountButton() {
  return (
    <>
      <Tooltip enterDelay={100} title="Count words on page" placement="bottom">
        <IconButton
          css={{ position: 'absolute', top: 0, right: 0 }}
          onClick={() => {
            countWords()
          }}
        >
          <TextFormat css={{ opacity: 0.7, fontSize: 20 }} />
        </IconButton>
      </Tooltip>
    </>
  )
}

export default WordsCountButton;