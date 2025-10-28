import { FormattedAnnouncementDto } from '../announcement/announcement.types.js';

export const getView = (
  from: string,
  departures: FormattedAnnouncementDto[]
) => {
  const formatter = Intl.DateTimeFormat('sv', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZone: 'CET',
  });

  const html = ` 
		<html>
		<head>
		<meta charset="utf-8">
		<meta name="TrainApi" >
		<meta name="description" content="Train bot for canceled trains">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>TrainApi</title>
		</head>
	<style>
      table,
      table td {
        border: 1px solid #cccccc;
      }
      td {
        height: 80px;
        width: 160px;
        text-align: center;
        vertical-align: middle;
      }
    </style>
	<h1>Departures from ${from} last 24 hours and next 12 hours</h1>
	<table>
	<tr>
	<th>From</th>
	<th>To</th>
	<th>Operator</th>
	<th>Train Number</th>
	<th>Info</th>
	<th>Advertised time</th>
	<th>Estimated time</th>
	<th>Canceled</th>
	</tr>
	${departures
    .slice(0)
    .reverse()
    .map((departure) => {
      const estimatedTime = departure.estimatedTimeAtLocation
        ? formatter.format(new Date(departure.estimatedTimeAtLocation))
        : 'no time';
      let trainInfo = '';
      departure.otherInformation?.forEach((info) => {
        trainInfo += info.description + ' ';
      });

      departure.productInformation?.forEach((info) => {
        trainInfo += info.description + ' ';
      });
      return `
			<tr>
			<td>
			${departure.fromName}
			</td>
			<td>
			${departure.toName}
			</td>
			<td>
			${departure.operator}
			</td>
			<td>
			${departure.advertisedTrainIdent}
			</td>
			<td>
			${trainInfo}
			</td>
			<td>
			${formatter.format(new Date(departure.advertisedTimeAtLocation))}
			</td>
      <td>
			${estimatedTime}
			</td>
      <td>
			${departure.canceled}
			</td>
			</tr>`;
    })}
	
	</table>
	</html>
	`;
  return html;
};
