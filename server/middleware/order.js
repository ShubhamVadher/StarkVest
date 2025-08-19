const axios = require('axios');

const url=process.env.Current_time
const HOLIDAYS = [
  "2025-2-26", "2025-3-14", "2025-3-31", "2025-4-10",
  "2025-4-14", "2025-4-18", "2025-5-1", "2025-8-15",
  "2025-8-27", "2025-10-2", "2025-10-21", "2025-10-22",
  "2025-11-5", "2025-12-25"
];

const order = async (req, res, next) => {
  try {
    const response = await axios.get(url);

    const data = response.data;
    let {  hours, minutes, seconds, dayofweek,day,month,year } = data;

    // dayofweek=4;
    // hours=13;
    // minutes=0;
    // seconds=0;
    // day=14;
    // month=4;
    // year=2025;
    
    //Weekend                                 
    if (dayofweek ==0 || dayofweek ==6) {
        return res.status(201).json({ message: 'Orders cannot be processed on weekends.' });
    }
    const date=year.toString()+"-"+month.toString()+"-"+day.toString();

    //Holiday
    if (HOLIDAYS.includes(date)) {
      return res.status(201).json({ message: 'Today is a public holiday. Orders cannot be processed.' });
    }

    const totalMinutes = 3600*hours+60*minutes+seconds;
    const marketOpen = 9 * 3600 + 60*15; 
    const marketClose = 15 * 3600 + 60*30; 

    if (totalMinutes < marketOpen || totalMinutes > marketClose) {
      return res.status(201).json({
        message: `Orders can only be placed between 09:15 and 15:30 IST. Current time: ${hours}:${minutes}:${seconds}`
      });
    }

    
    next();

  } catch (error) {
    console.error('Error verifying trading time:', error.message || error);
    return res.status(500).json({ error: 'Failed to verify market status.' });
  }
};

module.exports = order;
