import React, { useState, useEffect, useRef, useContext } from 'react'
import clsx from 'clsx'
import { MentionsInput, Mention } from 'react-mentions'

import { Label } from '../../models/Label'
import { LabelTagColor } from '../../components/LabelTag'

interface IProps {
  labels: Label[]
  portalCls?: string
  title: string
  handleChange?: (
    newValue: string,
    textValue: string,
    labelIds: number[],
    removedLabelIds: number[]
  ) => void
  isHeading: boolean
}

const defaultStyle = {
  '&singleLine': {
    display: 'inline-block',
  },
  suggestions: {
    zIndex: 10,
    marginTop: 32,
    list: {
      backgroundColor: 'white',
      border: '1px solid rgba(0,0,0,0.15)',
      borderRadius: '3px',
      fontSize: 14,
    },
    item: {
      padding: '5px 15px',
      borderBottom: '1px solid rgba(0,0,0,0.15)',
      '&focused': {
        backgroundColor: 'whitesmoke',
      },
    },
  },
}

function difference(setA, setB) {
  let _difference = new Set(setA)
  for (let elem of setB) {
    _difference.delete(elem)
  }
  return _difference
}

function TaggableInput(props: IProps) {
  const [curLabelIds, setCurLabelIds] = useState([])
  const titleInputRef = useRef<HTMLInputElement>()

  useEffect(() => {
    if (props.isHeading) {
      titleInputRef?.current?.setAttribute('readonly', 'true')
    } else {
      titleInputRef?.current?.removeAttribute('readonly')
    }
  })

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  const labels = props.labels.map((label) => {
    return { id: label.id, display: label.title, colorHex: label.color_hex }
  })

  function renderLabels(val) {
    return labels
      .filter((label) => label.display.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 8)
  }

  function handleChange(_evt, newValue: string, newPlainTextValue: string, newLabels) {
    if (props.handleChange) {
      const labelIds = newLabels.map((l) => parseInt(l.id))
      const set1 = new Set(labelIds)
      const set2 = new Set(curLabelIds)
      const diff = difference(set2, set1)
      props.handleChange(newValue, newPlainTextValue, labelIds, Array.from(diff) as number[])
      setCurLabelIds(labelIds)
    }
  }

  function renderSuggestion(entry, _search, highlightedDisplay) {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <LabelTagColor colorHex={entry.colorHex} />{' '}
        <span className="ml-1">{highlightedDisplay}</span>
      </div>
    )
  }

  return (
    <div className={clsx(props.isHeading && 'input-heading')}>
      <MentionsInput
        inputRef={titleInputRef}
        singleLine={true}
        value={props.title}
        onChange={props.handleChange && handleChange}
        style={defaultStyle}
        className={'input'}
        suggestionsPortalHost={props.portalCls && document.querySelector(props.portalCls)}
      >
        <Mention
          trigger="#"
          data={renderLabels}
          className="tag-highlight"
          markup={'#[__display__](__id__)'}
          displayTransform={(_id, display) => ` #${display}`}
          appendSpaceOnAdd={true}
          renderSuggestion={renderSuggestion}
        />
      </MentionsInput>
    </div>
  )
}

TaggableInput.defaultProps = {
  readOnly: false,
}

export default TaggableInput
