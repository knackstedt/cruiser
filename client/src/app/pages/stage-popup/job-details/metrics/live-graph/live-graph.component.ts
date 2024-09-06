import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { ECharts, EChartsOption, graphic, SeriesOption, TooltipComponentOption } from 'echarts';
import { NgxEchartsModule, NGX_ECHARTS_CONFIG } from 'ngx-echarts';

import 'echarts/theme/dark-bold.js';

@Component({
    selector: 'app-live-graph',
    templateUrl: './live-graph.component.html',
    styleUrls: ['./live-graph.component.scss'],
    imports: [
        NgxEchartsModule
    ],
    providers: [
        {
            provide: NGX_ECHARTS_CONFIG,
            useFactory: () => ({ echarts: () => import('echarts') })
        },
    ],
    standalone: true,
})
export class LiveGraphComponent {
    chart: ECharts;

    @Input() dataSource: {
        label: string,
        color: string,
        data: number[],
        tooltip
    }[];

    @Input() xaxis: EChartsOption['xAxis'];
    @Input() yaxis: EChartsOption['yAxis'] = [{ type: "value" }];

    @Input() tooltip: TooltipComponentOption | TooltipComponentOption[] = {
        trigger: 'axis',
        axisPointer: {
            type: 'cross',
            label: {
                backgroundColor: '#6a7985'
            }
        }
    }

    chartOption: EChartsOption;

    onChartInit(ec) {
        this.chart = ec;
    }

    hasInitializedSeries = false;
    ngOnInit() {
        const colors = this.dataSource.map(s => s.color);
        const labels = this.dataSource.map(s => s.label);

        const series = this.formatSeries();
        if (series.length > 0)
            this.hasInitializedSeries = true;

        this.chartOption = {
            color: colors,
            tooltip: this.tooltip,
            legend: {
                data: labels
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: [
                {
                    type: 'category',
                    boundaryGap: false,
                    data: this.xaxis as any,
                    position: "right",
                    splitLine: {
                        show: false
                    }
                }
            ],
            yAxis: this.yaxis as any,
            series: series as any
        };
    }

    formatSeries() {
        return this.dataSource.map(s => {
            return {
                name: s.label,
                type: 'line',
                lineStyle: {
                    width: 2
                },
                showSymbol: false,
                ...s
            };
        });
    }

    refresh() {
        if (!this.chart) return;
        const series = this.formatSeries();

        // If we now have a series to work with:
        if (series.length > 0 && this.hasInitializedSeries == false) {
            this.hasInitializedSeries = true;
        }

        this.chart.setOption({ series, animation: false });
    }
}
