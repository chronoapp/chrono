import React from 'react'
import clsx from 'clsx'
import { Label } from '../models/Label'

interface LabelTagColorProps {
  colorHex: string
  style?
  lighten: boolean
}
export function LabelTagColor(props: LabelTagColorProps) {
  let color = props.colorHex

  let style = { backgroundColor: color, opacity: props.lighten ? 0.4 : 1 }
  if (props.style) {
    style = { ...style, ...props.style }
  }

  return <div style={style} className={clsx('event-label-small')} />
}

LabelTagColor.defaultProps = {
  lighten: false,
}

interface LabelTagProps {
  label: Label
  allowEdit: boolean
  classNames?: string
  onClickDelete?: (e) => void
}

export function LabelTag(props: LabelTagProps) {
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
