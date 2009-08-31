function drawTabsOverTimeGraph(canvas, rawData, originX, originY, width, height) {
  let ctx = canvas.getContext("2d");

  let data = [];
  let firstTimestamp = null;
  let maxTabs = 0;

  // Convert raw data to structured data
  for (let row = 0; row < rawData.length; row++) {
    if (row == 0) {
      firstTimestamp = rawData[row].timestamp;
    }
    if (rawData[row].num_tabs > maxTabs) {
      maxTabs = rawData[row].num_tabs;
    }
    if (row > 0) {
      data.push( [rawData[row].timestamp - firstTimestamp,
		  rawData[row-1].num_tabs] );
    }
    data.push( [ rawData[row].timestamp - firstTimestamp,
		 rawData[row].num_tabs ] );
  }

  let lastTimestamp = data[data.length - 1][0];

  let xScale = width / lastTimestamp;
  let yScale = height / maxTabs;

  // Draw axes:
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX, originY - height);
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX + width, originY);
  ctx.stroke();

  function lineToDataPoint(dataX, dataY) {
    ctx.lineTo(originX + dataX * xScale, originY - dataY * yScale);
  }
  
  ctx.fillStyle = "rgb(200, 0, 0)";
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  for (let i = 0; i < data.length; i++) {
    lineToDataPoint( data[i][0], data[i][1] );
  }

  lineToDataPoint( data[data.length-1][0], 0);
  ctx.closePath();
  ctx.fill(); 

  // Add legend to graph...
  let label = 0;
  ctx.mozTextStyle = "12pt sans serif";
  ctx.fillStyle = "black";
  while (label < maxTabs) {
    ctx.beginPath();
    ctx.moveTo(originX, originY - label * yScale);
    ctx.lineTo(originX - 5, originY - label * yScale);
    ctx.stroke();
    ctx.save();
    ctx.translate(originX - 25, originY - label * yScale);
    ctx.mozDrawText(label);
    ctx.restore();
    label += 5;
  }
}


function drawCloseTabPieChart(canvas, rawData, originX, originY, radius) {
  let ctx = canvas.getContext("2d");
  let minTimeDiff = 2000; // 5 seconds
  // TODO split into smaller chunks -- 1 second 2 seconds 5 seconds 10 seconds?

  let numCloseEvents = 0;
  let numSwitchEvents = 0;
  let numClosedAndSwitched = 0;
  let lastCloseEventTime = 0;


  // TODO should we interpret it differently if you close a tab that
  // is not the one you're looking at?
  for (let row=0; row < rawData.length; row++) {
    if ( rawData[row].event_code == 2 ) {  // close event
      numCloseEvents ++;
      numSwitchEvents = 0;
      lastCloseEventTime = rawData[row].timestamp;
    }
    if (rawData[row].event_code == 4 ) { // switch event
      numSwitchEvents ++;
      if (numSwitchEvents == 2 && 
	  (rawData[row].timestamp - lastCloseEventTime) <= minTimeDiff) {
	numClosedAndSwitched ++;
      }
    }
  }

  let angle = 2*Math.PI * numClosedAndSwitched / numCloseEvents;

  let closedAndSwitchedColor = "rgb(200, 0, 0)";
  let justClosedColor = "rgb(0, 0, 200)";
  ctx.fillStyle = closedAndSwitchedColor
  ctx.beginPath();
  ctx.moveTo( originX, originY );
  ctx.lineTo( originX + radius * Math.cos( 0 ),
	      originY - radius * Math.sin( 0 ) );
  ctx.arc( originX, originY, radius, 0, angle, false);
  ctx.lineTo( originX, originY );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = justClosedColor;
  ctx.beginPath();
  ctx.moveTo( originX, originY );
  ctx.lineTo( originX + radius * Math.cos( angle ),
	      originY + radius * Math.sin( angle ) );
  ctx.arc( originX, originY, radius, angle, 2 * Math.PI, false);
  ctx.lineTo( originX, originY) ;
  ctx.fill();
  ctx.stroke();

  // Add legend to graph...
  ctx.fillStyle = closedAndSwitchedColor;
  ctx.fillRect( originX + radius + 10, 10, 20, 20 );
  ctx.strokeRect( originX + radius + 10, 10, 20, 20 );
  ctx.fillStyle = justClosedColor;
  ctx.fillRect( originX + radius + 10, 50, 20, 20 );
  ctx.strokeRect( originX + radius + 10, 50, 20, 20 );
  ctx.mozTextStyle = "12pt sans serif";
  ctx.fillStyle = "black";
  ctx.save();
  ctx.translate( originX + radius + 35, 30);
  ctx.mozDrawText("Switched");
  ctx.restore();
  ctx.translate( originX + radius + 35, 70);
  ctx.mozDrawText("Stayed");
  ctx.restore();

}
