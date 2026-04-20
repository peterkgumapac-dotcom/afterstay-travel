const React = require('react');
const { View, Text, StyleSheet } = require('react-native');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e6eef5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: '#556677', fontSize: 14 },
});

/**
 * Render a fallback MapView for web that displays a centered "Map preview unavailable on web" message.
 * @param {object} props - Component props.
 * @param {object|Array} [props.style] - Optional style or style array merged with the default container style.
 * @returns {React.Element} A React element containing a centered placeholder message for web environments.
 */
function MapView(props) {
  return React.createElement(
    View,
    { style: [styles.container, props.style] },
    React.createElement(Text, { style: styles.label }, 'Map preview unavailable on web')
  );
}

/**
 * Placeholder `Marker` component for web that renders nothing.
 *
 * @returns {null} `null` indicating no UI is rendered.
 */
function Marker() {
  return null;
}

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = Marker;
module.exports.Callout = () => null;
module.exports.Circle = () => null;
module.exports.Polyline = () => null;
module.exports.Polygon = () => null;
module.exports.PROVIDER_GOOGLE = 'google';
module.exports.PROVIDER_DEFAULT = undefined;
