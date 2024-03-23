import React from 'react';
import { DateTime } from 'luxon';

const TimezoneLabel = () => {
  // Get the local timezone offset in hours
  const timezoneOffset = DateTime.local().offset / 60;

  // Format the timezone as GMT+/-X
  const formatTimezone = (offset) => {
    // If the offset is 0, it means it's GMT
    if (offset === 0) return 'GMT';
    // Determine the sign and format accordingly
    const sign = offset < 0 ? '-' : '+';
    return `GMT${sign}${Math.abs(offset)}`;
  };

  return (
    <div>
      {formatTimezone(timezoneOffset)}
    </div>
  );
};

export default TimezoneLabel;
