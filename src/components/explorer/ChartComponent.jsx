import React, { useEffect, useRef } from 'react';

import { createChart, LineStyle } from 'lightweight-charts';

const ChartComponent = ({ client }) => {
    const chartContainerRef = useRef();
    const seriesRef = useRef();


    useEffect(() => {
        if (!client.host.includes('localhost')) {
            return; // Skip chart loading for public nodes
        }

        const handleResize = () => {
            chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        };
        const toSeconds = (ms) => Math.floor(ms / 1000);
        const determineGranularity = (timeRangeInSeconds) => {
            const oneHour = 60 * 60;
            const oneDay = 24 * oneHour;
            if (timeRangeInSeconds <= 12 * oneHour) return 600;       // 10 minutes
            if (timeRangeInSeconds <= 2 * oneDay) return 3600;        // 1 hour
            if (timeRangeInSeconds <= 15 * oneDay) return 6 * 3600;   // 6 hours
            return 86400;                                             // 1 day (maximum granularity)
        };

        const loadData = async (fromSeconds, toSeconds, granularity) => {
            try {
                const str2 = `/chain/hashrate/chart/time/${fromSeconds}/${toSeconds}/${granularity}`;
                const json = await client.get(str2);

                // Format the data as expected by Lightweight Charts
                const formattedData = json.data.chart.map(item => ({
                    time: item.timestamp,
                    value: item.hashrate
                }));

                // Update the chart with new data
                if (seriesRef.current && formattedData.length > 0) {
                    seriesRef.current.setData(formattedData);
                }

            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        const chart = createChart(chartContainerRef.current, {
            width: 600,
            height: 300,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        const series = chart.addLineSeries({
            color: 'rgb(0, 120, 255)',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
        });
        seriesRef.current = series;


        // Initial data load
        const now = Math.floor(Date.now() / 1000);
        const start2024 = 1704067200;
        loadData(start2024, now, 12 * 3600);
        // chart.timeScale().fitContent();

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    return <div ref={chartContainerRef} />;
};

export default ChartComponent;
