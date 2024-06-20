import { calculateColor } from './util/Color'
import { ZonedDateTime as DateTime, DayOfWeek } from '@js-joda/core'
import { LocalDate, DateTimeFormatter, ZoneId } from '@js-joda/core'

export interface TrendBlock {
  day: DateTime
  color: string
  link?: TrendLink
}

interface TrendLink {
  color: string
  density: number
}

/**
 * Generates an array of TrendBlocks with optional links between them based on the trend data.
 */
function getTrendBlocks(
  trendsMap: Map<string, number>,
  maxDuration: number,
  h: number,
  s: number,
  l: number
): TrendBlock[] {
  let consecutiveDays = 0
  let trendBlocks: TrendBlock[] = []
  const dateFormatter = DateTimeFormatter.ofPattern('yyyy-MM-dd')
  let entries = Array.from(trendsMap.entries()) // Convert map to array to access by index

  for (let i = 0; i < entries.length; i++) {
    const [dayString, value] = entries[i]
    try {
      const localDate = LocalDate.parse(dayString, dateFormatter)
      const day = localDate.atStartOfDay(ZoneId.systemDefault())
      let color = calculateColor(value, maxDuration, h, s, l)
      let block: TrendBlock = { day, color }

      // Check if there's a trend today and potentially tomorrow
      if (value > 0) {
        consecutiveDays++
        let nextValue = i + 1 < entries.length ? entries[i + 1][1] : 0 // Look ahead to the next day's value

        // Add a link if there's also a trend the next day and if its not the end of the week
        if (nextValue > 0) {
          if (!(day.dayOfWeek() === DayOfWeek.SATURDAY)) {
            block.link = {
              color: calculateColor(consecutiveDays * (maxDuration / 5), maxDuration, h, s, l),
              density: consecutiveDays,
            }
          }
        } else {
          consecutiveDays = 0 // Reset on no trend
        }
      }
      trendBlocks.push(block)
    } catch (error) {
      console.error('Failed to parse date:', dayString, error)
    }
  }

  return trendBlocks
}

export default getTrendBlocks
