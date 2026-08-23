/**
 * Pokémon GO-style avatar: a little picker standing on the map at the
 * user's own position, with a soft accuracy halo underneath. 46×62 SVG.
 */
export function playerSpriteSvg(): string {
  return `<svg width="46" height="62" viewBox="0 0 46 62" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
    <defs>
      <radialGradient id="halo">
        <stop offset="30%" stop-color="rgba(59,111,212,0.35)"/>
        <stop offset="100%" stop-color="rgba(59,111,212,0)"/>
      </radialGradient>
    </defs>
    <circle cx="23" cy="54" r="17" fill="url(#halo)"/>
    <ellipse cx="23" cy="55" rx="9" ry="3.2" fill="rgba(20,60,10,0.3)"/>

    <!-- legs -->
    <path d="M18.6 39h3.6v13a1.8 1.8 0 0 1-3.6 0Z" fill="#3D4E6B"/>
    <path d="M23.8 39h3.6v13a1.8 1.8 0 0 1-3.6 0Z" fill="#33435C"/>
    <!-- shoes -->
    <path d="M17.4 51.4h5v3.2h-5Z" rx="1" fill="#2B2B2B"/>
    <path d="M23.6 51.4h5v3.2h-5Z" rx="1" fill="#2B2B2B"/>

    <!-- basket of apples on the hip -->
    <path d="M31 34h7l-1 7h-5Z" fill="#B9822F"/>
    <circle cx="33" cy="34.5" r="1.7" fill="#D2422F"/>
    <circle cx="36" cy="34.5" r="1.7" fill="#E2573F"/>

    <!-- torso -->
    <path d="M15.5 25c0-4 3.4-6.5 7.5-6.5S30.5 21 30.5 25v11a1.8 1.8 0 0 1-1.8 1.8H17.3A1.8 1.8 0 0 1 15.5 36Z" fill="#38754A"/>
    <path d="M23 18.5c4.1 0 7.5 2.5 7.5 6.5v11a1.8 1.8 0 0 1-1.8 1.8H23Z" fill="#2F6540"/>
    <!-- arms -->
    <path d="M13.4 25.8a2.1 2.1 0 0 1 4 0v9a2 2 0 0 1-4 0Z" fill="#2F6540"/>
    <path d="M28.6 25.8a2.1 2.1 0 0 1 4 0v9a2 2 0 0 1-4 0Z" fill="#2F6540"/>
    <circle cx="15.4" cy="36" r="2.1" fill="#E8B98F"/>
    <circle cx="30.6" cy="36" r="2.1" fill="#E8B98F"/>

    <!-- head -->
    <circle cx="23" cy="12.5" r="7.5" fill="#EFC49B"/>
    <path d="M15.8 10.2a7.5 7.5 0 0 1 14.4 0c-2 1-4.4-1.4-7.2-1.4s-5.2 2.4-7.2 1.4Z" fill="#6B4527"/>
    <!-- cap brim -->
    <path d="M15.5 10.4c1.6-.9 3.4 1 7.5 1s5.9-1.9 7.5-1c.5.3.3 1.2-.5 1.4-3 .8-11 .8-14 0-.8-.2-1-1.1-.5-1.4Z" fill="#C9402F"/>
  </svg>`;
}
