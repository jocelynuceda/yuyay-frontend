import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

const STROKE = { fill: 'none', strokeWidth: 30, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Isotipo de Yuyay: la «Y» tejida dentro de un corazón, con su estrella. */
export function Isotipo({ size = 40, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <Mask id="tejido" maskUnits="userSpaceOnUse" x={0} y={0} width={512} height={512}>
          <Rect width={512} height={512} fill="#fff" />
          <Path
            d="M325 150 C325 313 317 374 256 430"
            fill="none"
            stroke="#000"
            strokeWidth={54}
            strokeLinecap="round"
          />
        </Mask>
      </Defs>
      <Path
        d="M167 150 C118 79 52 110 61 190 C72 290 180 360 256 430 C332 360 440 290 451 190 C460 110 394 79 325 150"
        stroke={color}
        mask="url(#tejido)"
        {...STROKE}
      />
      <Path
        d="M167 150 C167 255 185 304 246 304 C307 304 325 255 325 150 M325 150 C325 313 317 374 256 430"
        stroke={color}
        {...STROKE}
      />
      <Path
        d="M371 129 C375 150 385 160 406 164 C385 168 375 178 371 199 C367 178 357 168 336 164 C357 160 367 150 371 129 Z"
        fill={color}
      />
    </Svg>
  );
}
