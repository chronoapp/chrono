import React, { useState } from 'react'
import { Container, Flex, Box, Button, Text, Image } from '@chakra-ui/react'
import { LabelTagWithIcon } from '@/components/LabelTag'
import { BsFillBarChartFill } from 'react-icons/bs'
import { FiPlus } from 'react-icons/fi'

import ChronoLogo from '@/assets/chrono.svg'
import User from '@/models/User'
import { Label } from '@/models/Label'
import { makeUUID } from '@/lib/js-lib/makeId'

import { EditingLabelState } from '@/state/LabelsState'
import EditLabelModal from '@/components/LabelEditModal'

import * as API from '@/util/Api'

type Screen = '1_welcome' | '2_choose_tags'

export default function Onboarding(props: { user: User; onComplete: () => Promise<void> }) {
  const [step, setStep] = useState<Screen>('1_welcome')

  if (step === '1_welcome') {
    return <WelcomeScreen onContinue={() => setStep('2_choose_tags')} />
  } else {
    return <ChooseTagsScreen user={props.user} onContinue={props.onComplete} />
  }
}

function WelcomeScreen(props: { onContinue: () => void }) {
  return (
    <Container>
      <Flex direction="column" align="center" justify="center" height="100vh">
        <Image src={ChronoLogo} width="5em" />
        <Text fontSize="2xl" fontWeight={'bold'} textAlign="center" mt="4">
          Welcome to Chrono
        </Text>

        <Text textAlign="center" mt="4">
          Chrono is an open-source calendar and habit tracker to help you focus on getting the right
          things done.
        </Text>

        <Button mt="8" pl="8" pr="8" pt="4" pb="4" variant="outline" onClick={props.onContinue}>
          <Text fontSize="sm" fontWeight="medium">
            Get Started
          </Text>
        </Button>
      </Flex>
    </Container>
  )
}

function ChooseTagsScreen(props: { user: User; onContinue: () => Promise<void> }) {
  const [editingLabel, setEditingLabel] = React.useState<EditingLabelState>(undefined!)
  const [loading, setLoading] = useState<boolean>(false)

  const [labels, setLabels] = useState<Label[]>([
    new Label(makeUUID(), 'Work', 'work', '#219653', 0),
    new Label(makeUUID(), 'Gym', 'gym', '#219653', 1),
    new Label(makeUUID(), 'Learning', 'learning', '#F2994A', 2),
    new Label(makeUUID(), 'Social', 'social', '#F2C94C', 3),
    new Label(makeUUID(), 'Reading', 'reading', '#219653', 4),
    new Label(makeUUID(), 'Design', 'design', '#2F80ED', 5),
    new Label(makeUUID(), 'Health', 'health', '#EB5757', 6),
    new Label(makeUUID(), 'Finance', 'finance', '#2F80ED', 7),
  ])

  const handleDeleteLabel = (id: string) => {
    setLabels(labels.filter((label) => label.id !== id))
  }

  const handleClickAddNewTag = () => {
    setEditingLabel({
      active: true,
      labelTitle: '',
      labelId: undefined,
      labelColor: undefined,
    } as EditingLabelState)
  }

  /**
   * Create the initial set of tags for the user.
   */
  async function handleContinueWithTags() {
    setLoading(true)

    await API.putLabels(labels)
    await props.onContinue()

    setLoading(false)
  }

  return (
    <Container>
      <Flex direction="column" align="center" justify="center" height="100vh">
        <Box as={BsFillBarChartFill} size="80" color="#BDBDBD" />
        <Text fontSize="2xl" fontWeight={'bold'} textAlign="center" mt="4">
          Choose your tags
        </Text>

        <Text textAlign="center" mt="2">
          Tags are used to categorize your events and habits. Choose a few tags that represent the
          things you care about.
        </Text>

        <Flex flexWrap={'wrap'} maxW={'25em'} justifyContent={'center'} mt="4" mb="4">
          {labels.map((label) => (
            <Box mt="2" key={label.id}>
              <LabelTagWithIcon
                label={label}
                variant="icon"
                onClickDelete={() => handleDeleteLabel(label.id)}
                key={label.id}
              />
            </Box>
          ))}
          <Button
            fontSize={'xs'}
            color="gray.600"
            fontWeight="normal"
            variant="link"
            onClick={handleClickAddNewTag}
            float="left"
            mt="2"
          >
            <FiPlus /> add tag
          </Button>
        </Flex>

        <Button
          mt="8"
          pl="8"
          pr="8"
          pt="4"
          pb="4"
          variant="outline"
          onClick={handleContinueWithTags}
          isLoading={loading}
        >
          <Text fontSize="sm" fontWeight="medium">
            Continue to Chrono
          </Text>
        </Button>

        <Button mt="4" variant="ghost" onClick={props.onContinue} disabled={!loading}>
          <Text textColor="gray.500" fontSize="xs">
            no tags for now
          </Text>
        </Button>
      </Flex>

      {editingLabel && (
        <EditLabelModal
          editingLabel={editingLabel}
          onClickSaveLabel={(newLabel) => {
            const label = new Label(
              makeUUID(),
              newLabel.labelTitle,
              newLabel.labelTitle.toLowerCase(),
              newLabel.labelColor!.hex,
              labels.length + 1
            )

            setLabels([...labels, label])
            setEditingLabel(undefined!)
          }}
          onCloseModal={() => setEditingLabel(undefined!)}
        />
      )}
    </Container>
  )
}
