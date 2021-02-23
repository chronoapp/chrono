import React, { useState, useContext } from 'react'
import { Container } from '@chakra-ui/react'
import dynamic from 'next/dynamic'

import { LabelContext, LabelContextType } from '@/components/LabelsContext'
import Layout from '@/components/Layout'
import { auth } from '@/util/Api'
import { TrendView } from '@/trends/ViewSelector'
import { Label } from '@/models/Label'

const TrendChart = dynamic(() => import('@/trends/TrendChart'), { ssr: false })
const HabitGraph = dynamic(() => import('@/trends/HabitGraph'), { ssr: false })

interface IProps {
  authToken: string
}

function Trends(props: IProps) {
  const [selectedView, setSelectedView] = useState<TrendView>('CHART')
  const { labelState } = useContext<LabelContextType>(LabelContext)
  const [selectedLabel, setSelectedLabel] = useState<Label | undefined>(getDefaultLabel())

  function getDefaultLabel() {
    const allLabels = Object.values(labelState.labelsById)
    return allLabels && allLabels.length > 0 ? allLabels[0] : undefined
  }

  if (selectedView === 'CHART') {
    return (
      <TrendChart
        selectedLabel={selectedLabel}
        setSelectedLabel={(label) => {
          setSelectedLabel(label)
        }}
        authToken={props.authToken}
        setSelectedView={setSelectedView}
      />
    )
  } else {
    return (
      <HabitGraph
        setSelectedLabel={(label) => {
          setSelectedLabel(label)
        }}
        selectedLabel={selectedLabel}
        setSelectedView={setSelectedView}
      />
    )
  }
}

class TrendsPage extends React.Component<{ authToken: string }, {}> {
  static async getInitialProps(ctx) {
    const authToken = auth(ctx)
    return { authToken }
  }

  render() {
    return (
      <Layout>
        <Container minW="3xl" maxW="5xl" mt="2">
          <Trends authToken={this.props.authToken} />
        </Container>
      </Layout>
    )
  }
}

export default TrendsPage
