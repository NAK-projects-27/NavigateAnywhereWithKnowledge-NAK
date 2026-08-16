// ============================================
// InlineChatWeather.jsx - Weather Display
// ============================================
// Pure display component. Knows nothing about APIs or geocoding -
// it receives finished data and renders it.
//
// Same split as InlineChatMap: this file can be reused anywhere you
// already have weather data (a saved trip card, a profile page).
// ============================================

import PropTypes from 'prop-types';
import { iconFor, unitSymbol, windUnit } from '../api/weatherApi';

export default function InlineChatWeather({ placeName, current, forecast, units }) {
    const deg = unitSymbol(units);

    return (
        <div style={{
            marginTop: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(0, 224, 255, 0.2)',
            background: 'rgba(0, 224, 255, 0.04)',
            overflow: 'hidden'
        }}>
            {/* ---------- CURRENT CONDITIONS ---------- */}
            <div style={{
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                borderBottom: '1px solid rgba(0, 224, 255, 0.12)'
            }}>
                <div style={{ fontSize: '52px', lineHeight: 1 }}>
                    {iconFor(current.icon)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--neon-cyan)',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {placeName}
                    </div>

                    <div style={{
                        fontSize: '32px',
                        fontWeight: 700,
                        color: '#e6eef6',
                        lineHeight: 1.1
                    }}>
                        {current.temp}{deg}
                    </div>

                    <div style={{
                        fontSize: '14px',
                        color: '#e6eef6',
                        opacity: 0.75,
                        textTransform: 'capitalize'
                    }}>
                        {current.description}
                    </div>
                </div>

                {/* Secondary readings, stacked on the right */}
                <div style={{
                    fontSize: '13px',
                    color: '#e6eef6',
                    opacity: 0.75,
                    textAlign: 'right',
                    lineHeight: 1.7
                }}>
                    <div>Feels {current.feelsLike}{deg}</div>
                    <div>Humidity {current.humidity}%</div>
                    <div>Wind {current.windSpeed} {windUnit(units)}</div>
                </div>
            </div>

            {/* ---------- FORECAST STRIP ---------- */}
            {/* Horizontally scrollable so five days never overflow on mobile */}
            <div style={{
                display: 'flex',
                gap: '8px',
                padding: '14px',
                overflowX: 'auto'
            }}>
                {forecast.map(day => (
                    <div
                        key={day.dateKey}
                        style={{
                            flex: '1 0 78px',
                            minWidth: '78px',
                            padding: '12px 8px',
                            borderRadius: '10px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            textAlign: 'center'
                        }}
                    >
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--neon-cyan)',
                            marginBottom: '6px'
                        }}>
                            {day.label}
                        </div>

                        <div style={{ fontSize: '26px', lineHeight: 1.2 }}>
                            {iconFor(day.icon)}
                        </div>

                        <div style={{
                            marginTop: '6px',
                            fontSize: '13px',
                            color: '#e6eef6'
                        }}>
                            <span style={{ fontWeight: 600 }}>{day.high}°</span>
                            <span style={{ opacity: 0.55, marginLeft: '5px' }}>
                                {day.low}°
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

InlineChatWeather.propTypes = {
    placeName: PropTypes.string.isRequired,
    current: PropTypes.shape({
        temp: PropTypes.number.isRequired,
        feelsLike: PropTypes.number,
        humidity: PropTypes.number,
        windSpeed: PropTypes.number,
        description: PropTypes.string,
        icon: PropTypes.string
    }).isRequired,
    forecast: PropTypes.arrayOf(PropTypes.shape({
        dateKey: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        high: PropTypes.number.isRequired,
        low: PropTypes.number.isRequired,
        icon: PropTypes.string
    })).isRequired,
    units: PropTypes.string
};

InlineChatWeather.defaultProps = {
    units: 'imperial'
};