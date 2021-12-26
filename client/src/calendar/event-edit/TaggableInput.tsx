import React, { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Image } from '@chakra-ui/react'
import { MentionsInput, Mention } from 'react-mentions'

import * as API from '@/util/Api'
import Contact from '@/models/Contact'
import { Label } from '@/models/Label'
import { LabelTagColor } from '@/components/LabelTag'
import ContactCache from './ContactCache'

interface IProps {
  labels: Label[]
  wrapperCls?: string
  portalCls?: string
  title: string
  handleChange?: (newValue: string, labelIds: number[]) => void
  onUpdateContacts?: (contacts: Contact[]) => void
  onBlur?: (v) => void
  isHeading: boolean
  placeholder?: string
}

type TagType = 'Label' | 'Contact'

interface TagDisplay {
  id: number | string
  display: string
}

interface ContactTagDisplay extends TagDisplay {
  photoUrl: string
}

interface LabelTagDisplay extends TagDisplay {
  colorHex: string
}

/**
 * Id containing both the type and id of the tag
 * that we can extract it from the text input.
 */
function compositeId(id: number | string, type: TagType) {
  return `[id:${id}][type:${type}]`
}

function getIdAndType(idTxt: string) {
  const m = idTxt.match(/\[id:([\w]+)\]\[type:([\w]+)\]/)
  if (m) {
    const [_, id, type] = m
    return { id, type }
  }

  throw new Error(`Invalid Composite ID: ${idTxt}`)
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

/**
 * Input that allows #s to add tags.
 */
function TaggableInput(props: IProps) {
  const titleInputRef = useRef<HTMLInputElement>()
  const contactCache = new ContactCache()

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

  async function fetchContacts(query: string | undefined, callback) {
    if (!query) {
      return
    }

    const contacts = await API.getContacts(API.getAuthToken(), query)
    const contactsDisplay = contacts.map((contact) => ({
      id: compositeId(contact.id, 'Contact'),
      display: contact.displayName,
      photoUrl: contact.photoUrl,
    }))

    callback(contactsDisplay)
  }

  const labels: LabelTagDisplay[] = props.labels.map((label) => {
    return { id: compositeId(label.id, 'Label'), display: label.title, colorHex: label.color_hex }
  })

  function renderLabels(val) {
    return labels
      .filter((label) => label.display.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 8)
  }

  function renderLabelSuggestion(entry: LabelTagDisplay, _search, highlightedDisplay) {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <LabelTagColor colorHex={entry.colorHex} />{' '}
        <span className="ml-1">{highlightedDisplay}</span>
      </div>
    )
  }

  function renderContactSuggestion(entry: ContactTagDisplay, _search, highlightedDisplay) {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Image borderRadius="full" boxSize="24px" src={entry.photoUrl} />
        <span className="ml-1">{highlightedDisplay}</span>
      </div>
    )
  }

  /**
   * On every key stroke, check if we have a new entity (contact or label).
   */
  async function handleChange(_evt, newValue: string, newPlainTextValue: string, newEntities) {
    if (props.handleChange) {
      let title = newValue

      const labelIds: number[] = newEntities
        .filter((e) => getIdAndType(e.id).type === 'Label')
        .map((l) => parseInt(getIdAndType(l.id).id))

      const contactIds: string[] = newEntities
        .filter((e) => getIdAndType(e.id).type === 'Contact')
        .map((l) => getIdAndType(l.id).id)

      if (labelIds.length > 0) {
        title = title.replace(/#\[[\w\d ]+\]\(.+\)/g, '')
      }

      props.handleChange(title, labelIds)

      if (contactIds.length > 0) {
        Promise.all(contactIds.map((id) => contactCache.get(id))).then((contacts) => {
          props.onUpdateContacts && props.onUpdateContacts(contacts)
        })
      }
    }
  }

  return (
    <div className={clsx(props.wrapperCls, props.isHeading && 'input-heading')}>
      <MentionsInput
        inputRef={titleInputRef}
        singleLine={true}
        value={props.title}
        onChange={props.handleChange && handleChange}
        onBlur={props.onBlur}
        style={defaultStyle}
        className={'input'}
        placeholder={props.placeholder}
        suggestionsPortalHost={props.portalCls && document.querySelector(props.portalCls)}
      >
        <Mention
          trigger="#"
          data={renderLabels}
          className="tag-highlight"
          markup={'#[__display__](__id__)'}
          displayTransform={(_id, display) => ` #${display}`}
          renderSuggestion={renderLabelSuggestion}
        />
        <Mention
          trigger="@"
          data={fetchContacts}
          className="tag-highlight"
          markup={'@[__display__](__id__)'}
          displayTransform={(_id, display) => `@${display}`}
          renderSuggestion={renderContactSuggestion}
        />
      </MentionsInput>
    </div>
  )
}

TaggableInput.defaultProps = {
  readOnly: false,
}

export default TaggableInput
