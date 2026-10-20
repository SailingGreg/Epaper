# Epaper
This is a simple app that integrates a number of feeds and displays them on Waveshae 7.5 EPD (electronic paper display). For each of the data sources there is file to support exporing the api so that changes can be evaluated outside of the main display code. This makes development more straight forward and faster. The display is driven by a raspberry pi zero w and refreshes very 5 mins which reflects the weather update frequency.

The data sources are:
- The wind data comes from the club's weather station (Davis Vantage Pro and WeeWX)
- Events come from the clubs website which is wordpress based
- The weather observation are via the open weather network
- The forecast is from the met office via their datahub interface
- River flow comes from the EA as it is updated more regularly than the PLA
- and the tide info is scrapped from thametimes.org.uk

Note: any keys are injected by environment variables so you'll need to create your own epaper.env file and source this before running the code.

Also include here is the races program which sends out a summary email of upcoming races to the list 'racing@ranelaghsc.co.uk . This draws data from a number of sources:

- The race events come from the Club's wordpress site
- The duty scedule is scrapped from the club roster on dutyman.biz
- The tidal data from Thamestides.org
- And the weather from the metoffice 3 hourly 7 day forecast for the club




## dutyman.js

`js/dutyman.js` is the DutyMan duty scraper (`dutymand.py`) as a small JavaScript helper with no dependencies, so other apps (such as a race start app) can show who is on duty. It loads with a `<script>` tag (`window.Dutyman`) or `require()` in Node. dutyman.biz doesn't allow cross-origin requests, so fetch the roster on a server and parse it there:

```js
const Dutyman = require("./js/dutyman.js");
const duties = await Dutyman.fetchDuties("R0001532");   // [{date: "2026-10-25", event, duty, person}]
Dutyman.dutyList(duties, "2026-10-25");                  // "Duties: Safety Boat 1, ... . Safety Boat 2, ..."
```

`parseDuties(html)` takes the embed page's HTML if it's fetched some other way. Unlike `dutymand.py` it takes the roster ID as a parameter, works out the year of each date from its weekday (the roster shows "Sun, 03 Jan"), and keeps duties nobody has taken (person ""). Tests: `node --test js/dutyman.test.js`.
