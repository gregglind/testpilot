
// boundingRect expects an object like this:
// { originX: 0, originY: 0, width: 500, height: 300 }
// axes expects an object like this:
// { xScale: 1.5, yScale: 0.5, xMin: 0, xMax: 3000, yMin: -50, yMax: 50}

// TODO separate tab-study specific analysis from general graphing tools
function drawTimeSeriesGraph(canvas, data, boundingRect, axes, fillColor) {
  let ctx = canvas.getContext("2d");
  let br = boundingRect;
  // Draw axes:
  ctx.beginPath();
  ctx.moveTo(br.originX, br.originY);
  ctx.lineTo(br.originX, br.originY - br.height);
  ctx.moveTo(br.originX, br.originY);
  ctx.lineTo(br.originX + br.width, br.originY);
  ctx.stroke();

  function lineToDataPoint(dataX, dataY) {
    ctx.lineTo(br.originX + dataX * axes.xScale,
               br.originY - dataY * axes.yScale);
  }

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(br.originX, br.originY);
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
  while (label < axes.yMax) {
    ctx.beginPath();
    ctx.moveTo(br.originX, br.originY - label * axes.yScale);
    ctx.lineTo(br.originX - 5, br.originY - label * axes.yScale);
    ctx.stroke();
    ctx.save();
    ctx.translate(br.originX - 25, br.originY - label * axes.yScale);
    ctx.mozDrawText(label);
    ctx.restore();
    // TODO don't hard-code label interval.
    label += 5;
  }

}

function drawPieChart(canvas, data, origin, radius, colors, labels) {
  // TODO this is hard-coded right now to have 2 numbers in it but
  // could easily be generalized for more.
  let total = data[0] + data[1];

  let ctx = canvas.getContext("2d");
  let angle = 2*Math.PI * data[0] / total;

  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.moveTo( origin.x, origin.y);
  ctx.lineTo( origin.x + radius * Math.cos( 0 ),
	      origin.y - radius * Math.sin( 0 ) );
  ctx.arc( origin.x, origin.y, radius, 0, angle, false);
  ctx.lineTo( origin.x, origin.y );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.moveTo( origin.x, origin.y );
  ctx.lineTo( origin.x + radius * Math.cos( angle ),
	      origin.y + radius * Math.sin( angle ) );
  ctx.arc( origin.x, origin.y, radius, angle, 2 * Math.PI, false);
  ctx.lineTo( origin.x, origin.y) ;
  ctx.fill();
  ctx.stroke();

  // Add legend to graph...
  ctx.fillStyle = colors[0];
  ctx.fillRect( origin.x + radius + 10, 10, 20, 20 );
  ctx.strokeRect( origin.x + radius + 10, 10, 20, 20 );
  ctx.fillStyle = colors[1];
  ctx.fillRect( origin.x + radius + 10, 50, 20, 20 );
  ctx.strokeRect( origin.x + radius + 10, 50, 20, 20 );
  ctx.mozTextStyle = "12pt sans serif";
  ctx.fillStyle = "black";
  ctx.save();
  ctx.translate( origin.x + radius + 35, 30);
  ctx.mozDrawText(labels[0]);
  ctx.restore();
  ctx.translate( origin.x + radius + 35, 70);
  ctx.mozDrawText(labels[1]);
  ctx.restore();
}
