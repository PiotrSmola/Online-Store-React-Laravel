import { useEffect } from 'react';

const SHOP_NAME = 'Sklep';

export function usePageTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} | ${SHOP_NAME}`;
  }, [title]);
}
