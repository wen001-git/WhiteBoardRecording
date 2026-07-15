export const PRO_PLAN_PLACEHOLDER = '<meta name="whiteboard-plan" content="free" data-server-plan-grant />';
export const PRO_PLAN_GRANTED = '<meta name="whiteboard-plan" content="pro" data-server-plan-grant="verified" />';

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

export function injectProGrant(template) {
  const source = String(template || '');
  const placeholderCount = countOccurrences(source, PRO_PLAN_PLACEHOLDER);
  const activeGrantCount = (source.match(/<meta\b(?=[^>]*\bname=["']whiteboard-plan["'])(?=[^>]*\bcontent=["']pro["'])[^>]*>/gi) || []).length;

  if (placeholderCount !== 1 || activeGrantCount !== 0) {
    throw new Error('Protected app authorization marker is invalid');
  }

  const granted = source.replace(PRO_PLAN_PLACEHOLDER, PRO_PLAN_GRANTED);
  if (
    countOccurrences(granted, PRO_PLAN_PLACEHOLDER) !== 0 ||
    countOccurrences(granted, PRO_PLAN_GRANTED) !== 1
  ) {
    throw new Error('Protected app authorization injection failed');
  }

  return granted;
}
