const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  try {
    const nodePath = event.queryStringParameters.nodePath;
    const nodeBase = event.queryStringParameters.nodeBase || 'https://node.wartscan.io';
    if (!nodePath) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing nodePath query parameter' }),
      };
    }
    const targetUrl = `${nodeBase}/${nodePath}`;
    const options = {
      method: event.httpMethod,
      headers: { 'Content-Type': 'application/json' },
    };
    if (event.httpMethod === 'POST') {
      options.body = event.body;
    }
    const response = await fetch(targetUrl, options);
    const data = await response.text();
    return {
      statusCode: response.status,
      body: data,
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};