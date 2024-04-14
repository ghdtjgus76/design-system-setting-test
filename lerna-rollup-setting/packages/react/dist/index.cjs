'use strict';

var React = require('react');

// src/assert.ts
function isObject(value) {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

// src/compact.ts
function compact(value) {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([_, value2]) => value2 !== void 0));
}

// src/condition.ts
var isBaseCondition = (v) => v === "base";
function filterBaseConditions(c) {
  return c.slice().filter((v) => !isBaseCondition(v));
}

// src/hash.ts
function toChar(code) {
  return String.fromCharCode(code + (code > 25 ? 39 : 97));
}
function toName(code) {
  let name = "";
  let x;
  for (x = Math.abs(code); x > 52; x = x / 52 | 0)
    name = toChar(x % 52) + name;
  return toChar(x % 52) + name;
}
function toPhash(h, x) {
  let i = x.length;
  while (i)
    h = h * 33 ^ x.charCodeAt(--i);
  return h;
}
function toHash(value) {
  return toName(toPhash(5381, value) >>> 0);
}

// src/important.ts
var importantRegex = /\s*!(important)?/i;
function isImportant(value) {
  return typeof value === "string" ? importantRegex.test(value) : false;
}
function withoutImportant(value) {
  return typeof value === "string" ? value.replace(importantRegex, "").trim() : value;
}
function withoutSpace(str) {
  return typeof str === "string" ? str.replaceAll(" ", "_") : str;
}

// src/memo.ts
var memo = (fn) => {
  const cache = /* @__PURE__ */ new Map();
  const get = (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
  return get;
};

// src/merge-props.ts
function mergeProps(...sources) {
  const objects = sources.filter(Boolean);
  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach((key) => {
      const prevValue = prev[key];
      const value = obj[key];
      if (isObject(prevValue) && isObject(value)) {
        prev[key] = mergeProps(prevValue, value);
      } else {
        prev[key] = value;
      }
    });
    return prev;
  }, {});
}

// src/walk-object.ts
var isNotNullish = (element) => element != null;
function walkObject(target, predicate, options = {}) {
  const { stop, getKey } = options;
  function inner(value, path = []) {
    if (isObject(value) || Array.isArray(value)) {
      const result = {};
      for (const [prop, child] of Object.entries(value)) {
        const key = getKey?.(prop, child) ?? prop;
        const childPath = [...path, key];
        if (stop?.(value, childPath)) {
          return predicate(value, path);
        }
        const next = inner(child, childPath);
        if (isNotNullish(next)) {
          result[key] = next;
        }
      }
      return result;
    }
    return predicate(value, path);
  }
  return inner(target);
}

// src/normalize-style-object.ts
function toResponsiveObject(values, breakpoints) {
  return values.reduce(
    (acc, current, index) => {
      const key = breakpoints[index];
      if (current != null) {
        acc[key] = current;
      }
      return acc;
    },
    {}
  );
}
function normalizeStyleObject(styles, context, shorthand = true) {
  const { utility, conditions } = context;
  const { hasShorthand, resolveShorthand } = utility;
  return walkObject(
    styles,
    (value) => {
      return Array.isArray(value) ? toResponsiveObject(value, conditions.breakpoints.keys) : value;
    },
    {
      stop: (value) => Array.isArray(value),
      getKey: shorthand ? (prop) => hasShorthand ? resolveShorthand(prop) : prop : void 0
    }
  );
}

// src/classname.ts
var fallbackCondition = {
  shift: (v) => v,
  finalize: (v) => v,
  breakpoints: { keys: [] }
};
var sanitize = (value) => typeof value === "string" ? value.replaceAll(/[\n\s]+/g, " ") : value;
function createCss(context) {
  const { utility, hash, conditions: conds = fallbackCondition } = context;
  const formatClassName = (str) => [utility.prefix, str].filter(Boolean).join("-");
  const hashFn = (conditions, className) => {
    let result;
    if (hash) {
      const baseArray = [...conds.finalize(conditions), className];
      result = formatClassName(utility.toHash(baseArray, toHash));
    } else {
      const baseArray = [...conds.finalize(conditions), formatClassName(className)];
      result = baseArray.join(":");
    }
    return result;
  };
  return memo(({ base, ...styles } = {}) => {
    const styleObject = Object.assign(styles, base);
    const normalizedObject = normalizeStyleObject(styleObject, context);
    const classNames = /* @__PURE__ */ new Set();
    walkObject(normalizedObject, (value, paths) => {
      const important = isImportant(value);
      if (value == null)
        return;
      const [prop, ...allConditions] = conds.shift(paths);
      const conditions = filterBaseConditions(allConditions);
      const transformed = utility.transform(prop, withoutImportant(sanitize(value)));
      let className = hashFn(conditions, transformed.className);
      if (important)
        className = `${className}!`;
      classNames.add(className);
    });
    return Array.from(classNames).join(" ");
  });
}
function compactStyles(...styles) {
  return styles.filter((style) => isObject(style) && Object.keys(compact(style)).length > 0);
}
function createMergeCss(context) {
  function resolve(styles) {
    const allStyles = compactStyles(...styles);
    if (allStyles.length === 1)
      return allStyles;
    return allStyles.map((style) => normalizeStyleObject(style, context));
  }
  function mergeCss(...styles) {
    return mergeProps(...resolve(styles));
  }
  function assignCss(...styles) {
    return Object.assign({}, ...resolve(styles));
  }
  return { mergeCss: memo(mergeCss), assignCss };
}

// src/hypenate-property.ts
var wordRegex = /([A-Z])/g;
var msRegex = /^ms-/;
var hypenateProperty = memo((property) => {
  if (property.startsWith("--"))
    return property;
  return property.replace(wordRegex, "-$1").replace(msRegex, "-ms-").toLowerCase();
});

// src/is-css-unit.ts
var lengthUnits = "cm,mm,Q,in,pc,pt,px,em,ex,ch,rem,lh,rlh,vw,vh,vmin,vmax,vb,vi,svw,svh,lvw,lvh,dvw,dvh,cqw,cqh,cqi,cqb,cqmin,cqmax,%";
`(?:${lengthUnits.split(",").join("|")})`;

const conditionsStr = "_hover,_focus,_focusWithin,_focusVisible,_disabled,_active,_visited,_target,_readOnly,_readWrite,_empty,_checked,_enabled,_expanded,_highlighted,_before,_after,_firstLetter,_firstLine,_marker,_selection,_file,_backdrop,_first,_last,_only,_even,_odd,_firstOfType,_lastOfType,_onlyOfType,_peerFocus,_peerHover,_peerActive,_peerFocusWithin,_peerFocusVisible,_peerDisabled,_peerChecked,_peerInvalid,_peerExpanded,_peerPlaceholderShown,_groupFocus,_groupHover,_groupActive,_groupFocusWithin,_groupFocusVisible,_groupDisabled,_groupChecked,_groupExpanded,_groupInvalid,_indeterminate,_required,_valid,_invalid,_autofill,_inRange,_outOfRange,_placeholder,_placeholderShown,_pressed,_selected,_default,_optional,_open,_closed,_fullscreen,_loading,_currentPage,_currentStep,_motionReduce,_motionSafe,_print,_landscape,_portrait,_dark,_light,_osDark,_osLight,_highContrast,_lessContrast,_moreContrast,_ltr,_rtl,_scrollbar,_scrollbarThumb,_scrollbarTrack,_horizontal,_vertical,_starting,sm,smOnly,smDown,md,mdOnly,mdDown,lg,lgOnly,lgDown,xl,xlOnly,xlDown,2xl,2xlOnly,2xlDown,smToMd,smToLg,smToXl,smTo2xl,mdToLg,mdToXl,mdTo2xl,lgToXl,lgTo2xl,xlTo2xl,@/xs,@/sm,@/md,@/lg,@/xl,@/2xl,@/3xl,@/4xl,@/5xl,@/6xl,@/7xl,@/8xl,base";
const conditions = new Set(conditionsStr.split(','));

function isCondition(value){
  return conditions.has(value) || /^@|&|&$/.test(value)
}

const underscoreRegex = /^_/;
const conditionsSelectorRegex = /&|@/;

function finalizeConditions(paths){
  return paths.map((path) => {
    if (conditions.has(path)){
      return path.replace(underscoreRegex, '')
    }

    if (conditionsSelectorRegex.test(path)){
      return `[${withoutSpace(path.trim())}]`
    }

    return path
  })}

  function sortConditions(paths){
    return paths.sort((a, b) => {
      const aa = isCondition(a);
      const bb = isCondition(b);
      if (aa && !bb) return 1
      if (!aa && bb) return -1
      return 0
    })
  }

const utilities = "aspectRatio:aspect,boxDecorationBreak:decoration,zIndex:z,boxSizing:box,objectPosition:obj-pos,objectFit:obj-fit,overscrollBehavior:overscroll,overscrollBehaviorX:overscroll-x,overscrollBehaviorY:overscroll-y,position:pos/1,top:top,left:left,insetInline:inset-x/insetX,insetBlock:inset-y/insetY,inset:inset,insetBlockEnd:inset-b,insetBlockStart:inset-t,insetInlineEnd:end/insetEnd/1,insetInlineStart:start/insetStart/1,right:right,bottom:bottom,float:float,visibility:vis,display:d,hideFrom:hide,hideBelow:show,flexBasis:basis,flex:flex,flexDirection:flex/flexDir,flexGrow:grow,flexShrink:shrink,gridTemplateColumns:grid-cols,gridTemplateRows:grid-rows,gridColumn:col-span,gridRow:row-span,gridColumnStart:col-start,gridColumnEnd:col-end,gridAutoFlow:grid-flow,gridAutoColumns:auto-cols,gridAutoRows:auto-rows,gap:gap,gridGap:gap,gridRowGap:gap-x,gridColumnGap:gap-y,rowGap:gap-x,columnGap:gap-y,justifyContent:justify,alignContent:content,alignItems:items,alignSelf:self,padding:p/1,paddingLeft:pl/1,paddingRight:pr/1,paddingTop:pt/1,paddingBottom:pb/1,paddingBlock:py/1/paddingY,paddingBlockEnd:pb,paddingBlockStart:pt,paddingInline:px/paddingX/1,paddingInlineEnd:pe/1/paddingEnd,paddingInlineStart:ps/1/paddingStart,marginLeft:ml/1,marginRight:mr/1,marginTop:mt/1,marginBottom:mb/1,margin:m/1,marginBlock:my/1/marginY,marginBlockEnd:mb,marginBlockStart:mt,marginInline:mx/1/marginX,marginInlineEnd:me/1/marginEnd,marginInlineStart:ms/1/marginStart,spaceX:space-x,spaceY:space-y,outlineWidth:ring-width/ringWidth,outlineColor:ring-color/ringColor,outline:ring/1,outlineOffset:ring-offset/ringOffset,divideX:divide-x,divideY:divide-y,divideColor:divide-color,divideStyle:divide-style,width:w/1,inlineSize:w,minWidth:min-w/minW,minInlineSize:min-w,maxWidth:max-w/maxW,maxInlineSize:max-w,height:h/1,blockSize:h,minHeight:min-h/minH,minBlockSize:min-h,maxHeight:max-h/maxH,maxBlockSize:max-b,color:text,fontFamily:font,fontSize:fs,fontWeight:fw,fontSmoothing:smoothing,fontVariantNumeric:numeric,letterSpacing:tracking,lineHeight:leading,textAlign:text-align,textDecoration:text-decor,textDecorationColor:text-decor-color,textEmphasisColor:text-emphasis-color,textDecorationStyle:decoration-style,textDecorationThickness:decoration-thickness,textUnderlineOffset:underline-offset,textTransform:text-transform,textIndent:indent,textShadow:text-shadow,textShadowColor:text-shadow/textShadowColor,textOverflow:text-overflow,verticalAlign:v-align,wordBreak:break,textWrap:text-wrap,truncate:truncate,lineClamp:clamp,listStyleType:list-type,listStylePosition:list-pos,listStyleImage:list-img,backgroundPosition:bg-pos/bgPosition,backgroundPositionX:bg-pos-x/bgPositionX,backgroundPositionY:bg-pos-y/bgPositionY,backgroundAttachment:bg-attach/bgAttachment,backgroundClip:bg-clip/bgClip,background:bg/1,backgroundColor:bg/bgColor,backgroundOrigin:bg-origin/bgOrigin,backgroundImage:bg-img/bgImage,backgroundRepeat:bg-repeat/bgRepeat,backgroundBlendMode:bg-blend/bgBlendMode,backgroundSize:bg-size/bgSize,backgroundGradient:bg-gradient/bgGradient,textGradient:text-gradient,gradientFromPosition:gradient-from-pos,gradientToPosition:gradient-to-pos,gradientFrom:gradient-from,gradientTo:gradient-to,gradientVia:gradient-via,gradientViaPosition:gradient-via-pos,borderRadius:rounded/1,borderTopLeftRadius:rounded-tl/roundedTopLeft,borderTopRightRadius:rounded-tr/roundedTopRight,borderBottomRightRadius:rounded-br/roundedBottomRight,borderBottomLeftRadius:rounded-bl/roundedBottomLeft,borderTopRadius:rounded-t/roundedTop,borderRightRadius:rounded-r/roundedRight,borderBottomRadius:rounded-b/roundedBottom,borderLeftRadius:rounded-l/roundedLeft,borderStartStartRadius:rounded-ss/roundedStartStart,borderStartEndRadius:rounded-se/roundedStartEnd,borderStartRadius:rounded-s/roundedStart,borderEndStartRadius:rounded-es/roundedEndStart,borderEndEndRadius:rounded-ee/roundedEndEnd,borderEndRadius:rounded-e/roundedEnd,border:border,borderWidth:border-w,borderTopWidth:border-tw,borderLeftWidth:border-lw,borderRightWidth:border-rw,borderBottomWidth:border-bw,borderColor:border,borderInline:border-x/borderX,borderInlineWidth:border-x/borderXWidth,borderInlineColor:border-x/borderXColor,borderBlock:border-y/borderY,borderBlockWidth:border-y/borderYWidth,borderBlockColor:border-y/borderYColor,borderLeft:border-l,borderLeftColor:border-l,borderInlineStart:border-s/borderStart,borderInlineStartWidth:border-s/borderStartWidth,borderInlineStartColor:border-s/borderStartColor,borderRight:border-r,borderRightColor:border-r,borderInlineEnd:border-e/borderEnd,borderInlineEndWidth:border-e/borderEndWidth,borderInlineEndColor:border-e/borderEndColor,borderTop:border-t,borderTopColor:border-t,borderBottom:border-b,borderBottomColor:border-b,borderBlockEnd:border-be,borderBlockEndColor:border-be,borderBlockStart:border-bs,borderBlockStartColor:border-bs,boxShadow:shadow/1,boxShadowColor:shadow-color/shadowColor,mixBlendMode:mix-blend,filter:filter,brightness:brightness,contrast:contrast,grayscale:grayscale,hueRotate:hue-rotate,invert:invert,saturate:saturate,sepia:sepia,dropShadow:drop-shadow,blur:blur,backdropFilter:backdrop,backdropBlur:backdrop-blur,backdropBrightness:backdrop-brightness,backdropContrast:backdrop-contrast,backdropGrayscale:backdrop-grayscale,backdropHueRotate:backdrop-hue-rotate,backdropInvert:backdrop-invert,backdropOpacity:backdrop-opacity,backdropSaturate:backdrop-saturate,backdropSepia:backdrop-sepia,borderCollapse:border,borderSpacing:border-spacing,borderSpacingX:border-spacing-x,borderSpacingY:border-spacing-y,tableLayout:table,transitionTimingFunction:ease,transitionDelay:delay,transitionDuration:duration,transitionProperty:transition-prop,transition:transition,animation:animation,animationName:animation-name,animationTimingFunction:animation-ease,animationDuration:animation-duration,animationDelay:animation-delay,transformOrigin:origin,rotate:rotate,rotateX:rotate-x,rotateY:rotate-y,rotateZ:rotate-z,scale:scale,scaleX:scale-x,scaleY:scale-y,translate:translate,translateX:translate-x/x,translateY:translate-y/y,translateZ:translate-z/z,accentColor:accent,caretColor:caret,scrollBehavior:scroll,scrollbar:scrollbar,scrollMargin:scroll-m,scrollMarginLeft:scroll-ml,scrollMarginRight:scroll-mr,scrollMarginTop:scroll-mt,scrollMarginBottom:scroll-mb,scrollMarginBlock:scroll-my/scrollMarginY,scrollMarginBlockEnd:scroll-mb,scrollMarginBlockStart:scroll-mt,scrollMarginInline:scroll-mx/scrollMarginX,scrollMarginInlineEnd:scroll-me,scrollMarginInlineStart:scroll-ms,scrollPadding:scroll-p,scrollPaddingBlock:scroll-pb/scrollPaddingY,scrollPaddingBlockStart:scroll-pt,scrollPaddingBlockEnd:scroll-pb,scrollPaddingInline:scroll-px/scrollPaddingX,scrollPaddingInlineEnd:scroll-pe,scrollPaddingInlineStart:scroll-ps,scrollPaddingLeft:scroll-pl,scrollPaddingRight:scroll-pr,scrollPaddingTop:scroll-pt,scrollPaddingBottom:scroll-pb,scrollSnapAlign:snap-align,scrollSnapStop:snap-stop,scrollSnapType:snap-type,scrollSnapStrictness:snap-strictness,scrollSnapMargin:snap-m,scrollSnapMarginTop:snap-mt,scrollSnapMarginBottom:snap-mb,scrollSnapMarginLeft:snap-ml,scrollSnapMarginRight:snap-mr,touchAction:touch,userSelect:select,fill:fill,stroke:stroke,strokeWidth:stroke-w,srOnly:sr,debug:debug,appearance:appearance,backfaceVisibility:backface,clipPath:clip-path,hyphens:hyphens,mask:mask,maskImage:mask-image,maskSize:mask-size,textSizeAdjust:text-adjust,container:cq,containerName:cq-name,containerType:cq-type,textStyle:textStyle";

const classNameByProp = new Map();
const shorthands = new Map();
utilities.split(',').forEach((utility) => {
  const [prop, meta] = utility.split(':');
  const [className, ...shorthandList] = meta.split('/');
  classNameByProp.set(prop, className);
  if (shorthandList.length) {
    shorthandList.forEach((shorthand) => {
      shorthands.set(shorthand === '1' ? className : shorthand, prop);
    });
  }
});

const resolveShorthand = (prop) => shorthands.get(prop) || prop;

const context = {
  
  conditions: {
    shift: sortConditions,
    finalize: finalizeConditions,
    breakpoints: { keys: ["base","sm","md","lg","xl","2xl"] }
  },
  utility: {
    
    transform: (prop, value) => {
              const key = resolveShorthand(prop);
              const propKey = classNameByProp.get(key) || hypenateProperty(key);
              return { className: `${propKey}_${withoutSpace(value)}` }
            },
    hasShorthand: true,
    toHash: (path, hashFn) => hashFn(path.join(":")),
    resolveShorthand: resolveShorthand,
  }
};

const cssFn = createCss(context);
const css = (...styles) => cssFn(mergeCss(...styles));
css.raw = (...styles) => mergeCss(...styles);

const { mergeCss, assignCss } = createMergeCss(context);

var testUtil = function testUtil() {
  console.log("test");
};

function styleInject(css, ref) {
  if ( ref === void 0 ) ref = {};
  var insertAt = ref.insertAt;

  if (!css || typeof document === 'undefined') { return; }

  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.type = 'text/css';

  if (insertAt === 'top') {
    if (head.firstChild) {
      head.insertBefore(style, head.firstChild);
    } else {
      head.appendChild(style);
    }
  } else {
    head.appendChild(style);
  }

  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }
}

var css_248z = "@layer reset, base, tokens, recipes, utilities;\n@import url(\"../dist/styles.css\");\n@layer reset {\n  html,:host {\n    --font-fallback: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';\n    -webkit-text-size-adjust: 100%;\n    -webkit-font-smoothing: antialiased;\n    -moz-osx-font-smoothing: grayscale;\n    -moz-tab-size: 4;\n    tab-size: 4;\n    -webkit-tap-highlight-color: transparent;\n    line-height: 1.5;\n    font-family: var(--global-font-body, var(--font-fallback));\n}\n\n  *,::before,::after,::backdrop,::first-letter,::file-selector-button {\n    margin: 0px;\n    padding: 0px;\n    box-sizing: border-box;\n    border-width: 0px;\n    border-style: solid;\n    border-color: var(--global-color-border, currentColor);\n}\n\n  hr {\n    height: 0px;\n    color: inherit;\n    border-top-width: 1px;\n}\n\n  body {\n    height: 100%;\n    line-height: inherit;\n}\n\n  img {\n    border-style: none;\n}\n\n  img,svg,video,canvas,audio,iframe,embed,object {\n    display: block;\n    vertical-align: middle;\n}\n\n  img,video {\n    max-width: 100%;\n    height: auto;\n}\n\n  h1,h2,h3,h4,h5,h6 {\n    text-wrap: balance;\n    font-size: inherit;\n    font-weight: inherit;\n}\n\n  p,h1,h2,h3,h4,h5,h6 {\n    overflow-wrap: break-word;\n}\n\n  ol,ul,menu {\n    list-style: none;\n}\n\n  button,input:where([type='button'], [type='reset'], [type='submit']),::file-selector-button {\n    appearance: button;\n    -webkit-appearance: button;\n}\n\n  button,input,optgroup,select,textarea,::file-selector-button {\n    font: inherit;\n    font-feature-settings: inherit;\n    font-variation-settings: inherit;\n    letter-spacing: inherit;\n    color: inherit;\n    background: var(--colors-transparent);\n}\n\n  ::placeholder {\n    opacity: 1;\n    --placeholder-fallback: color-mix(in srgb, currentColor 50%, transparent);\n    color: var(--global-color-placeholder, var(--placeholder-fallback));\n}\n\n  select,textarea,input:where(:not([type='button'], [type='reset'], [type='submit'])) {\n    border-width: 1px;\n    border-style: solid;\n}\n\n  textarea {\n    resize: vertical;\n}\n\n  table {\n    text-indent: 0px;\n    border-collapse: collapse;\n    border-color: inherit;\n}\n\n  summary {\n    display: list-item;\n}\n\n  small {\n    font-size: 80%;\n}\n\n  sub,sup {\n    position: relative;\n    vertical-align: baseline;\n    font-size: 75%;\n    line-height: 0;\n}\n\n  sub {\n    bottom: -0.25em;\n}\n\n  sup {\n    top: -0.5em;\n}\n\n  dialog {\n    padding: 0px;\n}\n\n  a {\n    color: inherit;\n    text-decoration: inherit;\n}\n\n  abbr:where([title]) {\n    text-decoration: underline dotted;\n}\n\n  b,strong {\n    font-weight: bolder;\n}\n\n  code,kbd,samp,pre {\n    --font-mono-fallback: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New';\n    font-feature-settings: normal;\n    font-variation-settings: normal;\n    font-family: var(--global-font-mono, var(--font-mono-fallback));\n    font-size: 1em;\n}\n\n  progress {\n    vertical-align: baseline;\n}\n\n  ::-webkit-search-decoration,::-webkit-search-cancel-button {\n    -webkit-appearance: none;\n}\n\n  ::-webkit-inner-spin-button,::-webkit-outer-spin-button {\n    height: auto;\n}\n\n  :-moz-ui-invalid {\n    box-shadow: none;\n}\n\n  :-moz-focusring {\n    outline: auto;\n}\n\n  [hidden] {\n    display: none !important;\n}\n}\n@layer base {\n  :root {\n    --made-with-panda: '🐼';\n}\n\n  *,::before,::after,::backdrop {\n    --blur: /*-*/ /*-*/;\n    --brightness: /*-*/ /*-*/;\n    --contrast: /*-*/ /*-*/;\n    --grayscale: /*-*/ /*-*/;\n    --hue-rotate: /*-*/ /*-*/;\n    --invert: /*-*/ /*-*/;\n    --saturate: /*-*/ /*-*/;\n    --sepia: /*-*/ /*-*/;\n    --drop-shadow: /*-*/ /*-*/;\n    --backdrop-blur: /*-*/ /*-*/;\n    --backdrop-brightness: /*-*/ /*-*/;\n    --backdrop-contrast: /*-*/ /*-*/;\n    --backdrop-grayscale: /*-*/ /*-*/;\n    --backdrop-hue-rotate: /*-*/ /*-*/;\n    --backdrop-invert: /*-*/ /*-*/;\n    --backdrop-opacity: /*-*/ /*-*/;\n    --backdrop-saturate: /*-*/ /*-*/;\n    --backdrop-sepia: /*-*/ /*-*/;\n    --gradient-from-position: /*-*/ /*-*/;\n    --gradient-to-position: /*-*/ /*-*/;\n    --gradient-via-position: /*-*/ /*-*/;\n    --scroll-snap-strictness: proximity;\n    --border-spacing-x: 0;\n    --border-spacing-y: 0;\n    --translate-x: 0;\n    --translate-y: 0;\n    --rotate: 0;\n    --rotate-x: 0;\n    --rotate-y: 0;\n    --skew-x: 0;\n    --skew-y: 0;\n    --scale-x: 1;\n    --scale-y: 1;\n}\n}\n@layer tokens {\n  :where(:root, :host) {\n    --aspect-ratios-square: 1 / 1;\n    --aspect-ratios-landscape: 4 / 3;\n    --aspect-ratios-portrait: 3 / 4;\n    --aspect-ratios-wide: 16 / 9;\n    --aspect-ratios-ultrawide: 18 / 5;\n    --aspect-ratios-golden: 1.618 / 1;\n    --borders-none: none;\n    --easings-default: cubic-bezier(0.4, 0, 0.2, 1);\n    --easings-linear: linear;\n    --easings-in: cubic-bezier(0.4, 0, 1, 1);\n    --easings-out: cubic-bezier(0, 0, 0.2, 1);\n    --easings-in-out: cubic-bezier(0.4, 0, 0.2, 1);\n    --durations-fastest: 50ms;\n    --durations-faster: 100ms;\n    --durations-fast: 150ms;\n    --durations-normal: 200ms;\n    --durations-slow: 300ms;\n    --durations-slower: 400ms;\n    --durations-slowest: 500ms;\n    --radii-xs: 0.125rem;\n    --radii-sm: 0.25rem;\n    --radii-md: 0.375rem;\n    --radii-lg: 0.5rem;\n    --radii-xl: 0.75rem;\n    --radii-2xl: 1rem;\n    --radii-3xl: 1.5rem;\n    --radii-full: 9999px;\n    --font-weights-thin: 100;\n    --font-weights-extralight: 200;\n    --font-weights-light: 300;\n    --font-weights-normal: 400;\n    --font-weights-medium: 500;\n    --font-weights-semibold: 600;\n    --font-weights-bold: 700;\n    --font-weights-extrabold: 800;\n    --font-weights-black: 900;\n    --line-heights-none: 1;\n    --line-heights-tight: 1.25;\n    --line-heights-snug: 1.375;\n    --line-heights-normal: 1.5;\n    --line-heights-relaxed: 1.625;\n    --line-heights-loose: 2;\n    --fonts-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\";\n    --fonts-serif: ui-serif, Georgia, Cambria, \"Times New Roman\", Times, serif;\n    --fonts-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace;\n    --letter-spacings-tighter: -0.05em;\n    --letter-spacings-tight: -0.025em;\n    --letter-spacings-normal: 0em;\n    --letter-spacings-wide: 0.025em;\n    --letter-spacings-wider: 0.05em;\n    --letter-spacings-widest: 0.1em;\n    --font-sizes-2xs: 0.5rem;\n    --font-sizes-xs: 0.75rem;\n    --font-sizes-sm: 0.875rem;\n    --font-sizes-md: 1rem;\n    --font-sizes-lg: 1.125rem;\n    --font-sizes-xl: 1.25rem;\n    --font-sizes-2xl: 1.5rem;\n    --font-sizes-3xl: 1.875rem;\n    --font-sizes-4xl: 2.25rem;\n    --font-sizes-5xl: 3rem;\n    --font-sizes-6xl: 3.75rem;\n    --font-sizes-7xl: 4.5rem;\n    --font-sizes-8xl: 6rem;\n    --font-sizes-9xl: 8rem;\n    --shadows-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);\n    --shadows-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);\n    --shadows-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);\n    --shadows-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);\n    --shadows-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);\n    --shadows-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);\n    --shadows-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);\n    --colors-current: currentColor;\n    --colors-black: #000;\n    --colors-white: #fff;\n    --colors-transparent: rgb(0 0 0 / 0);\n    --colors-rose-50: #fff1f2;\n    --colors-rose-100: #ffe4e6;\n    --colors-rose-200: #fecdd3;\n    --colors-rose-300: #fda4af;\n    --colors-rose-400: #fb7185;\n    --colors-rose-500: #f43f5e;\n    --colors-rose-600: #e11d48;\n    --colors-rose-700: #be123c;\n    --colors-rose-800: #9f1239;\n    --colors-rose-900: #881337;\n    --colors-rose-950: #4c0519;\n    --colors-pink-50: #fdf2f8;\n    --colors-pink-100: #fce7f3;\n    --colors-pink-200: #fbcfe8;\n    --colors-pink-300: #f9a8d4;\n    --colors-pink-400: #f472b6;\n    --colors-pink-500: #ec4899;\n    --colors-pink-600: #db2777;\n    --colors-pink-700: #be185d;\n    --colors-pink-800: #9d174d;\n    --colors-pink-900: #831843;\n    --colors-pink-950: #500724;\n    --colors-fuchsia-50: #fdf4ff;\n    --colors-fuchsia-100: #fae8ff;\n    --colors-fuchsia-200: #f5d0fe;\n    --colors-fuchsia-300: #f0abfc;\n    --colors-fuchsia-400: #e879f9;\n    --colors-fuchsia-500: #d946ef;\n    --colors-fuchsia-600: #c026d3;\n    --colors-fuchsia-700: #a21caf;\n    --colors-fuchsia-800: #86198f;\n    --colors-fuchsia-900: #701a75;\n    --colors-fuchsia-950: #4a044e;\n    --colors-purple-50: #faf5ff;\n    --colors-purple-100: #f3e8ff;\n    --colors-purple-200: #e9d5ff;\n    --colors-purple-300: #d8b4fe;\n    --colors-purple-400: #c084fc;\n    --colors-purple-500: #a855f7;\n    --colors-purple-600: #9333ea;\n    --colors-purple-700: #7e22ce;\n    --colors-purple-800: #6b21a8;\n    --colors-purple-900: #581c87;\n    --colors-purple-950: #3b0764;\n    --colors-violet-50: #f5f3ff;\n    --colors-violet-100: #ede9fe;\n    --colors-violet-200: #ddd6fe;\n    --colors-violet-300: #c4b5fd;\n    --colors-violet-400: #a78bfa;\n    --colors-violet-500: #8b5cf6;\n    --colors-violet-600: #7c3aed;\n    --colors-violet-700: #6d28d9;\n    --colors-violet-800: #5b21b6;\n    --colors-violet-900: #4c1d95;\n    --colors-violet-950: #2e1065;\n    --colors-indigo-50: #eef2ff;\n    --colors-indigo-100: #e0e7ff;\n    --colors-indigo-200: #c7d2fe;\n    --colors-indigo-300: #a5b4fc;\n    --colors-indigo-400: #818cf8;\n    --colors-indigo-500: #6366f1;\n    --colors-indigo-600: #4f46e5;\n    --colors-indigo-700: #4338ca;\n    --colors-indigo-800: #3730a3;\n    --colors-indigo-900: #312e81;\n    --colors-indigo-950: #1e1b4b;\n    --colors-blue-50: #eff6ff;\n    --colors-blue-100: #dbeafe;\n    --colors-blue-200: #bfdbfe;\n    --colors-blue-300: #93c5fd;\n    --colors-blue-400: #60a5fa;\n    --colors-blue-500: #3b82f6;\n    --colors-blue-600: #2563eb;\n    --colors-blue-700: #1d4ed8;\n    --colors-blue-800: #1e40af;\n    --colors-blue-900: #1e3a8a;\n    --colors-blue-950: #172554;\n    --colors-sky-50: #f0f9ff;\n    --colors-sky-100: #e0f2fe;\n    --colors-sky-200: #bae6fd;\n    --colors-sky-300: #7dd3fc;\n    --colors-sky-400: #38bdf8;\n    --colors-sky-500: #0ea5e9;\n    --colors-sky-600: #0284c7;\n    --colors-sky-700: #0369a1;\n    --colors-sky-800: #075985;\n    --colors-sky-900: #0c4a6e;\n    --colors-sky-950: #082f49;\n    --colors-cyan-50: #ecfeff;\n    --colors-cyan-100: #cffafe;\n    --colors-cyan-200: #a5f3fc;\n    --colors-cyan-300: #67e8f9;\n    --colors-cyan-400: #22d3ee;\n    --colors-cyan-500: #06b6d4;\n    --colors-cyan-600: #0891b2;\n    --colors-cyan-700: #0e7490;\n    --colors-cyan-800: #155e75;\n    --colors-cyan-900: #164e63;\n    --colors-cyan-950: #083344;\n    --colors-teal-50: #f0fdfa;\n    --colors-teal-100: #ccfbf1;\n    --colors-teal-200: #99f6e4;\n    --colors-teal-300: #5eead4;\n    --colors-teal-400: #2dd4bf;\n    --colors-teal-500: #14b8a6;\n    --colors-teal-600: #0d9488;\n    --colors-teal-700: #0f766e;\n    --colors-teal-800: #115e59;\n    --colors-teal-900: #134e4a;\n    --colors-teal-950: #042f2e;\n    --colors-emerald-50: #ecfdf5;\n    --colors-emerald-100: #d1fae5;\n    --colors-emerald-200: #a7f3d0;\n    --colors-emerald-300: #6ee7b7;\n    --colors-emerald-400: #34d399;\n    --colors-emerald-500: #10b981;\n    --colors-emerald-600: #059669;\n    --colors-emerald-700: #047857;\n    --colors-emerald-800: #065f46;\n    --colors-emerald-900: #064e3b;\n    --colors-emerald-950: #022c22;\n    --colors-green-50: #f0fdf4;\n    --colors-green-100: #dcfce7;\n    --colors-green-200: #bbf7d0;\n    --colors-green-300: #86efac;\n    --colors-green-400: #4ade80;\n    --colors-green-500: #22c55e;\n    --colors-green-600: #16a34a;\n    --colors-green-700: #15803d;\n    --colors-green-800: #166534;\n    --colors-green-900: #14532d;\n    --colors-green-950: #052e16;\n    --colors-lime-50: #f7fee7;\n    --colors-lime-100: #ecfccb;\n    --colors-lime-200: #d9f99d;\n    --colors-lime-300: #bef264;\n    --colors-lime-400: #a3e635;\n    --colors-lime-500: #84cc16;\n    --colors-lime-600: #65a30d;\n    --colors-lime-700: #4d7c0f;\n    --colors-lime-800: #3f6212;\n    --colors-lime-900: #365314;\n    --colors-lime-950: #1a2e05;\n    --colors-yellow-50: #fefce8;\n    --colors-yellow-100: #fef9c3;\n    --colors-yellow-200: #fef08a;\n    --colors-yellow-300: #fde047;\n    --colors-yellow-400: #facc15;\n    --colors-yellow-500: #eab308;\n    --colors-yellow-600: #ca8a04;\n    --colors-yellow-700: #a16207;\n    --colors-yellow-800: #854d0e;\n    --colors-yellow-900: #713f12;\n    --colors-yellow-950: #422006;\n    --colors-amber-50: #fffbeb;\n    --colors-amber-100: #fef3c7;\n    --colors-amber-200: #fde68a;\n    --colors-amber-300: #fcd34d;\n    --colors-amber-400: #fbbf24;\n    --colors-amber-500: #f59e0b;\n    --colors-amber-600: #d97706;\n    --colors-amber-700: #b45309;\n    --colors-amber-800: #92400e;\n    --colors-amber-900: #78350f;\n    --colors-amber-950: #451a03;\n    --colors-orange-50: #fff7ed;\n    --colors-orange-100: #ffedd5;\n    --colors-orange-200: #fed7aa;\n    --colors-orange-300: #fdba74;\n    --colors-orange-400: #fb923c;\n    --colors-orange-500: #f97316;\n    --colors-orange-600: #ea580c;\n    --colors-orange-700: #c2410c;\n    --colors-orange-800: #9a3412;\n    --colors-orange-900: #7c2d12;\n    --colors-orange-950: #431407;\n    --colors-red-50: #fef2f2;\n    --colors-red-100: #fee2e2;\n    --colors-red-200: #fecaca;\n    --colors-red-300: #fca5a5;\n    --colors-red-400: #f87171;\n    --colors-red-500: #ef4444;\n    --colors-red-600: #dc2626;\n    --colors-red-700: #b91c1c;\n    --colors-red-800: #991b1b;\n    --colors-red-900: #7f1d1d;\n    --colors-red-950: #450a0a;\n    --colors-neutral-50: #fafafa;\n    --colors-neutral-100: #f5f5f5;\n    --colors-neutral-200: #e5e5e5;\n    --colors-neutral-300: #d4d4d4;\n    --colors-neutral-400: #a3a3a3;\n    --colors-neutral-500: #737373;\n    --colors-neutral-600: #525252;\n    --colors-neutral-700: #404040;\n    --colors-neutral-800: #262626;\n    --colors-neutral-900: #171717;\n    --colors-neutral-950: #0a0a0a;\n    --colors-stone-50: #fafaf9;\n    --colors-stone-100: #f5f5f4;\n    --colors-stone-200: #e7e5e4;\n    --colors-stone-300: #d6d3d1;\n    --colors-stone-400: #a8a29e;\n    --colors-stone-500: #78716c;\n    --colors-stone-600: #57534e;\n    --colors-stone-700: #44403c;\n    --colors-stone-800: #292524;\n    --colors-stone-900: #1c1917;\n    --colors-stone-950: #0c0a09;\n    --colors-zinc-50: #fafafa;\n    --colors-zinc-100: #f4f4f5;\n    --colors-zinc-200: #e4e4e7;\n    --colors-zinc-300: #d4d4d8;\n    --colors-zinc-400: #a1a1aa;\n    --colors-zinc-500: #71717a;\n    --colors-zinc-600: #52525b;\n    --colors-zinc-700: #3f3f46;\n    --colors-zinc-800: #27272a;\n    --colors-zinc-900: #18181b;\n    --colors-zinc-950: #09090b;\n    --colors-gray-50: #f9fafb;\n    --colors-gray-100: #f3f4f6;\n    --colors-gray-200: #e5e7eb;\n    --colors-gray-300: #d1d5db;\n    --colors-gray-400: #9ca3af;\n    --colors-gray-500: #6b7280;\n    --colors-gray-600: #4b5563;\n    --colors-gray-700: #374151;\n    --colors-gray-800: #1f2937;\n    --colors-gray-900: #111827;\n    --colors-gray-950: #030712;\n    --colors-slate-50: #f8fafc;\n    --colors-slate-100: #f1f5f9;\n    --colors-slate-200: #e2e8f0;\n    --colors-slate-300: #cbd5e1;\n    --colors-slate-400: #94a3b8;\n    --colors-slate-500: #64748b;\n    --colors-slate-600: #475569;\n    --colors-slate-700: #334155;\n    --colors-slate-800: #1e293b;\n    --colors-slate-900: #0f172a;\n    --colors-slate-950: #020617;\n    --blurs-sm: 4px;\n    --blurs-base: 8px;\n    --blurs-md: 12px;\n    --blurs-lg: 16px;\n    --blurs-xl: 24px;\n    --blurs-2xl: 40px;\n    --blurs-3xl: 64px;\n    --spacing-0: 0rem;\n    --spacing-1: 0.25rem;\n    --spacing-2: 0.5rem;\n    --spacing-3: 0.75rem;\n    --spacing-4: 1rem;\n    --spacing-5: 1.25rem;\n    --spacing-6: 1.5rem;\n    --spacing-7: 1.75rem;\n    --spacing-8: 2rem;\n    --spacing-9: 2.25rem;\n    --spacing-10: 2.5rem;\n    --spacing-11: 2.75rem;\n    --spacing-12: 3rem;\n    --spacing-14: 3.5rem;\n    --spacing-16: 4rem;\n    --spacing-20: 5rem;\n    --spacing-24: 6rem;\n    --spacing-28: 7rem;\n    --spacing-32: 8rem;\n    --spacing-36: 9rem;\n    --spacing-40: 10rem;\n    --spacing-44: 11rem;\n    --spacing-48: 12rem;\n    --spacing-52: 13rem;\n    --spacing-56: 14rem;\n    --spacing-60: 15rem;\n    --spacing-64: 16rem;\n    --spacing-72: 18rem;\n    --spacing-80: 20rem;\n    --spacing-96: 24rem;\n    --spacing-0\\.5: 0.125rem;\n    --spacing-1\\.5: 0.375rem;\n    --spacing-2\\.5: 0.625rem;\n    --spacing-3\\.5: 0.875rem;\n    --sizes-0: 0rem;\n    --sizes-1: 0.25rem;\n    --sizes-2: 0.5rem;\n    --sizes-3: 0.75rem;\n    --sizes-4: 1rem;\n    --sizes-5: 1.25rem;\n    --sizes-6: 1.5rem;\n    --sizes-7: 1.75rem;\n    --sizes-8: 2rem;\n    --sizes-9: 2.25rem;\n    --sizes-10: 2.5rem;\n    --sizes-11: 2.75rem;\n    --sizes-12: 3rem;\n    --sizes-14: 3.5rem;\n    --sizes-16: 4rem;\n    --sizes-20: 5rem;\n    --sizes-24: 6rem;\n    --sizes-28: 7rem;\n    --sizes-32: 8rem;\n    --sizes-36: 9rem;\n    --sizes-40: 10rem;\n    --sizes-44: 11rem;\n    --sizes-48: 12rem;\n    --sizes-52: 13rem;\n    --sizes-56: 14rem;\n    --sizes-60: 15rem;\n    --sizes-64: 16rem;\n    --sizes-72: 18rem;\n    --sizes-80: 20rem;\n    --sizes-96: 24rem;\n    --sizes-0\\.5: 0.125rem;\n    --sizes-1\\.5: 0.375rem;\n    --sizes-2\\.5: 0.625rem;\n    --sizes-3\\.5: 0.875rem;\n    --sizes-xs: 20rem;\n    --sizes-sm: 24rem;\n    --sizes-md: 28rem;\n    --sizes-lg: 32rem;\n    --sizes-xl: 36rem;\n    --sizes-2xl: 42rem;\n    --sizes-3xl: 48rem;\n    --sizes-4xl: 56rem;\n    --sizes-5xl: 64rem;\n    --sizes-6xl: 72rem;\n    --sizes-7xl: 80rem;\n    --sizes-8xl: 90rem;\n    --sizes-prose: 65ch;\n    --sizes-full: 100%;\n    --sizes-min: min-content;\n    --sizes-max: max-content;\n    --sizes-fit: fit-content;\n    --sizes-breakpoint-sm: 640px;\n    --sizes-breakpoint-md: 768px;\n    --sizes-breakpoint-lg: 1024px;\n    --sizes-breakpoint-xl: 1280px;\n    --sizes-breakpoint-2xl: 1536px;\n    --animations-spin: spin 1s linear infinite;\n    --animations-ping: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;\n    --animations-pulse: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;\n    --animations-bounce: bounce 1s infinite;\n    --breakpoints-sm: 640px;\n    --breakpoints-md: 768px;\n    --breakpoints-lg: 1024px;\n    --breakpoints-xl: 1280px;\n    --breakpoints-2xl: 1536px;\n}\n\n  @keyframes spin {\n    to {\n      transform: rotate(360deg);\n}\n}\n\n  @keyframes ping {\n    75%,100% {\n      transform: scale(2);\n      opacity: 0;\n}\n}\n\n  @keyframes pulse {\n    50% {\n      opacity: 0.5;\n}\n}\n\n  @keyframes bounce {\n    0%,100% {\n      transform: translateY(-25%);\n      animation-timing-function: cubic-bezier(0.8,0,1,1);\n}\n\n    50% {\n      transform: none;\n      animation-timing-function: cubic-bezier(0,0,0.2,1);\n}\n}\n}\n@layer utilities {\n  .bg_red\\.300 {\n    background: var(--colors-red-300);\n}\n\n  .px_4 {\n    padding-inline: var(--spacing-4);\n}\n\n  .py_3 {\n    padding-block: var(--spacing-3);\n}\n\n  .rounded_md {\n    border-radius: var(--radii-md);\n}\n\n  .font_Inter {\n    font-family: Inter;\n}\n\n  .hover\\:bg_red\\.400:is(:hover, [data-hover]) {\n    background: var(--colors-red-400);\n}\n}\n";
styleInject(css_248z);

function Button(_ref) {
  var children = _ref.children;
  var handleClick = function handleClick() {
    testUtil();
  };
  return /*#__PURE__*/React.createElement("button", {
    onClick: handleClick,
    className: css({
      bg: "red.300",
      fontFamily: "Inter",
      px: "4",
      py: "3",
      borderRadius: "md",
      _hover: {
        bg: "red.400"
      }
    })
  }, children);
}

exports.Button = Button;
