import React from 'react';
export default function Link({href,children,prefetch,replace,scroll,...props}){return <a {...props} href={typeof href==='string'&&href.startsWith('/')?'#'+href:href}>{children}</a>}
