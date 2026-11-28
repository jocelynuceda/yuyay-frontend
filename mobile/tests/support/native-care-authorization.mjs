import React from 'react';
export { View, Text, fonts, radius, makeStyles, useTheme } from './native-empty-state.mjs';
export const Pressable = ({ children, disabled, accessibilityLabel }) =>
  React.createElement('button', { disabled, 'aria-label': accessibilityLabel }, children);
export const Button = ({ children }) => React.createElement('button', null, children);
export const Ionicons = () => React.createElement('span', { 'data-icon': true });
export const FormCard = ({ children }) => React.createElement('section', null, children);
export const StatusMessage = ({ message }) => React.createElement('p', null, message);
