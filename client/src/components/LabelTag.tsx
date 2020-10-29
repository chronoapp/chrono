import React from 'react'
import clsx from 'clsx'
import { Label } from '../models/Label'

interface IProps {
  label: Label
  allowEdit: boolean
  onClickDelete?: (e) => void
}

function LabelTag(props: IProps) {
  return (
    <div className={clsx('tag', 'mr-1', props.allowEdit && 'pr-0')}>
      <div
        style={{ backgroundColor: props.label.color_hex }}
        className={clsx('event-label-small', 'dropdown-trigger')}
      />
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

export default LabelTag
