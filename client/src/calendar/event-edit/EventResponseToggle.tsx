import React from 'react'

import { Tabs, Tab, TabList } from '@chakra-ui/react'
import { ResponseStatus } from '@/models/EventParticipant'

interface IProps {
  initialStatus: ResponseStatus
  onUpdateResponseStatus: (status: ResponseStatus) => void
}

type TabData = { label: string; value: ResponseStatus }

const tabs: TabData[] = [
  { label: 'Yes', value: 'accepted' },
  { label: 'No', value: 'declined' },
  { label: 'Maybe', value: 'tentative' },
]

function EventResponseToggle(props: IProps) {
  const [tabIndex, setTabIndex] = React.useState(findIndex(props.initialStatus))

  function findIndex(status: ResponseStatus) {
    return tabs.findIndex((tab) => tab.value === status)
  }

  return (
    <Tabs
      variant="soft-rounded"
      colorScheme="blackAlpha"
      size="sm"
      index={tabIndex}
      onChange={(idx) => {
        setTabIndex(idx)
        const responseStatus = tabs[idx].value
        props.onUpdateResponseStatus(responseStatus)
      }}
    >
      <TabList>
        {tabs.map((tab) => (
          <Tab
            border="1px solid"
            borderColor={'gray.100'}
            ml="1"
            pt="0.5"
            pb="0.5"
            fontWeight="500"
            key={tab.value}
            _selected={{ bg: 'gray.200' }}
          >
            {tab.label}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  )
}

export default EventResponseToggle
