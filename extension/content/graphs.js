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
}


function drawCloseTabPieChart(canvas, rawData, originX, originY, radius) {
  let ctx = canvas.getContext("2d");
  let minTimeDiff = 5000; // 5 seconds

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
	  rawData[row].event_code - lastCloseEventTime <= minTimeDiff) {
	numClosedAndSwitched ++;
      }
    }
  }

  let redAngle = 2*Math.PI * numClosedAndSwitched / numCloseEvents;

  ctx.fillStyle = "rgb(200, 0, 0)";
  ctx.beginPath();
  ctx.moveTo( originX, originY );
  ctx.lineTo( originX + radius * Math.cos( 0 ),
	      originY - radius * Math.sin( 0 ) );
  ctx.arc( originX, originY, radius, 0, redAngle, true);
  ctx.lineTo( originX, originY );
  ctx.fill();

  ctx.fillStyle = "rgb(0, 0, 200)";
  ctx.beginPath();
  ctx.moveTo( originX, originY );
  ctx.lineTo( originX + radius * Math.cos( redAngle ),
	      originY + radius * Math.sin( redAngle ) );
  ctx.arc( originX, originY, radius, redAngle, 2 * Math.PI, true);
  ctx.lineTo( originX, originY) ;
  ctx.fill();

}
