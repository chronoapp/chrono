import React from 'react'
import clsx from 'clsx'
import { Label } from '../models/Label'

interface IProps {
  label: Label
  allowEdit: boolean
  classNames?: string
  onClickDelete?: (e) => void
}

export function LabelTagColor(props: { colorHex: string; style? }) {
  let style = { backgroundColor: props.colorHex }
  if (props.style) {
    style = { ...style, ...props.style }
  }

  return <div style={style} className={clsx('event-label-small')} />
}

export function LabelTag(props: IProps) {
  return (
    <div
      className={clsx(
        'tag',
        'mr-1',
        props.allowEdit && 'pr-0',
        props.classNames && props.classNames
      )}
    >
      <LabelTagColor colorHex={props.label.color_hex} />
      <span style={{ display: 'inline-block' }} className="pl-1">
        {props.label.title}
      </span>
      {props.allowEdit && (
        <a
          onClick={(e) => props.onClickDelete && props.onClickDelete(e)}
          className="tag is-delete"
        ></a>
      )}
    </div>
  )
}
