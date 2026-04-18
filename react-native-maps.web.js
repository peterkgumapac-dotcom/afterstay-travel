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

function MapView(props) {
  return React.createElement(
    View,
    { style: [styles.container, props.style] },
    React.createElement(Text, { style: styles.label }, 'Map preview unavailable on web')
  );
}

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
