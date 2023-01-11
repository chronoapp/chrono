import Layout from '@/components/Layout'
import Calendar from '@/calendar/Calendar'

function Home() {
  return (
    <Layout canCreateEvent={true}>
      <Calendar />
    </Layout>
  )
}

export default Home
