/**
 * components/TreeGamification.js
 * Widget Interactivo de Gamificación: Árbol de Crecimiento Dinámico Evolutivo (SVG + CSS)
 * Evoluciona reactivamente según el porcentaje de puntos alcanzado respecto a la meta mensual (0% a 100%).
 * 
 * Etapas:
 *  0% - 19%: Brote inicial en tierra húmeda con partículas sutiles.
 * 20% - 39%: Pequeño árbol en crecimiento con orugas animadas en los tallos.
 * 40% - 59%: Árbol joven con follaje verde y mariposas revoloteando alrededor.
 * 60% - 79%: Árbol frondoso con ardillas animadas en las ramas.
 * 80% - 99%: Árbol maduro repleto de frutos brillantes y destellos dorados.
 * 100% (Meta Alcanzada): Animación especial con caída de Semilla Dorada, liberación del Premio del Mes y reinicio de ciclo.
 */

window.InventoryApp = window.InventoryApp || {};

class TreeGamificationWidget {
    constructor(containerId = 'tree-gamification-container') {
        this.containerId = containerId;
        this.porcentaje = 0;
        this.puntosActuales = 0;
        this.puntosMeta = 200;
        this.nivelCiclo = 1;
        this.simulacionActiva = false;
        this.premioActual = null;
    }

    /**
     * Determina la etapa actual del árbol según el porcentaje
     */
    obtenerEtapa(pct) {
        const p = Math.max(0, Math.min(100, Math.round(pct)));
        if (p < 20) {
            return {
                nivel: 1,
                id: 'brote',
                titulo: 'Brote Inicial',
                subtitulo: 'Tierra húmeda y primeros brotes de fidelidad',
                rango: '0% - 19%',
                color: '#16a34a',
                icono: '🌱',
                descripcion: 'Tu viaje de recompensas está comenzando. Con cada compra tu brote absorbe nutrientes y crecerá con vigor.'
            };
        } else if (p < 40) {
            return {
                nivel: 2,
                id: 'tallo_orugas',
                titulo: 'Tallo en Crecimiento con Orugas',
                subtitulo: 'Pequeño árbol con simpáticas orugas laboriosas',
                rango: '20% - 39%',
                color: '#65a30d',
                icono: '🐛',
                descripcion: 'El tallo se fortalece y las orugas ayudan a nutrir las ramas jóvenes. ¡Sigue así!'
            };
        } else if (p < 60) {
            return {
                nivel: 3,
                id: 'joven_mariposas',
                titulo: 'Árbol Joven y Mariposas',
                subtitulo: 'Follaje esmeralda con mariposas multicolores',
                rango: '40% - 59%',
                color: '#059669',
                icono: '🦋',
                descripcion: '¡La metamorfosis ha ocurrido! Mariposas revolotean alrededor de la copa verde anunciando tu constancia.'
            };
        } else if (p < 80) {
            return {
                nivel: 4,
                id: 'frondoso_ardillas',
                titulo: 'Árbol Frondoso y Ardillas',
                subtitulo: 'Gran copa con ardillas juguetonas en las ramas',
                rango: '60% - 79%',
                color: '#047857',
                icono: '🐿️',
                descripcion: 'Copa abundante y ramas fuertes donde habitan ardillas alegres. ¡Ya estás muy cerca de la meta mensual!'
            };
        } else if (p < 100) {
            return {
                nivel: 5,
                id: 'maduro_frutos',
                titulo: 'Árbol Maduro de Frutos Brillantes',
                subtitulo: 'Cargado de manzanas y peras doradas resplandecientes',
                rango: '80% - 99%',
                color: '#d97706',
                icono: '🍎',
                descripcion: '¡Casi listo para cosechar! Los frutos dorados brillan con luz propia listos para el gran premio.'
            };
        } else {
            return {
                nivel: 6,
                id: 'meta_dorada',
                titulo: '¡Meta Alcanzada! Semilla Dorada',
                subtitulo: 'Cosecha completada · Premio del Mes Desbloqueado',
                rango: '100%',
                color: '#eab308',
                icono: '🌟',
                descripcion: '¡Felicidades! La semilla dorada ha germinado el premio del mes. Reclámalo e inicia un nuevo ciclo para el siguiente nivel.'
            };
        }
    }

    /**
     * Genera el contenido SVG del Árbol según la etapa
     */
    generarSVGArbol(pct) {
        const etapa = this.obtenerEtapa(pct);
        const p = Math.max(0, Math.min(100, Math.round(pct)));

        let svgContent = '';

        if (etapa.nivel === 1) {
            // ETAPA 1: Brote inicial en tierra fértil con rocío y partículas
            svgContent = `
                <!-- Suelo / Tierra fértil con montículo -->
                <ellipse cx="200" cy="270" rx="140" ry="24" fill="#3f2719" opacity="0.9" />
                <ellipse cx="200" cy="265" rx="110" ry="18" fill="#5c3822" />
                <path d="M 140 268 Q 200 248 260 268 Q 200 280 140 268 Z" fill="#78472a" />
                
                <!-- Rocío y piedritas -->
                <circle cx="165" cy="262" r="3" fill="#a36941" />
                <circle cx="235" cy="265" r="4" fill="#a36941" />
                <circle cx="190" cy="272" r="2.5" fill="#8c5836" />
                
                <!-- Tallo del brote -->
                <path class="sprout-stem" d="M 200 260 Q 198 220 200 195" stroke="#4ade80" stroke-width="6" stroke-linecap="round" fill="none" />
                
                <!-- Hojas tiernas del brote con animación de brisa -->
                <g class="sprout-leaves" transform-origin="200 195">
                    <!-- Hoja Izquierda -->
                    <path d="M 200 195 C 175 185 165 160 185 155 C 205 150 200 190 200 195 Z" fill="#22c55e" />
                    <path d="M 198 190 Q 185 170 180 162" stroke="#86efac" stroke-width="1.5" fill="none" />
                    <!-- Hoja Derecha -->
                    <path d="M 200 195 C 225 185 235 160 215 155 C 195 150 200 190 200 195 Z" fill="#16a34a" />
                    <path d="M 202 190 Q 215 170 220 162" stroke="#86efac" stroke-width="1.5" fill="none" />
                    <!-- Brote central diminuto -->
                    <circle cx="200" cy="188" r="4" fill="#86efac" />
                </g>

                <!-- Partículas de rocío y nutrientes flotantes -->
                <g class="tree-particles">
                    <circle cx="180" cy="210" r="2.5" fill="#38bdf8" opacity="0.8" class="particle-float-1" />
                    <circle cx="220" cy="200" r="2" fill="#4ade80" opacity="0.8" class="particle-float-2" />
                    <circle cx="195" cy="165" r="3" fill="#fde047" opacity="0.9" class="particle-float-3" />
                </g>
            `;
        } else if (etapa.nivel === 2) {
            // ETAPA 2: Tallo joven en crecimiento con orugas animadas en los tallos
            svgContent = `
                <!-- Suelo -->
                <ellipse cx="200" cy="275" rx="145" ry="24" fill="#3f2719" />
                <ellipse cx="200" cy="270" rx="120" ry="18" fill="#5c3822" />
                
                <!-- Tallo principal leñoso joven -->
                <path d="M 194 270 Q 192 210 196 150 Q 200 120 200 95 Q 200 120 204 150 Q 208 210 206 270 Z" fill="#854d0e" />
                
                <!-- Ramitas laterales -->
                <!-- Rama izquierda -->
                <path d="M 196 185 Q 165 175 140 165" stroke="#713f12" stroke-width="4.5" stroke-linecap="round" fill="none" />
                <path d="M 140 165 C 130 155 125 140 145 138 C 160 136 150 160 140 165 Z" fill="#22c55e" />
                <path d="M 155 170 C 145 155 140 145 158 145 Z" fill="#16a34a" />

                <!-- Rama derecha -->
                <path d="M 204 170 Q 235 158 260 145" stroke="#713f12" stroke-width="4.5" stroke-linecap="round" fill="none" />
                <path d="M 260 145 C 275 135 280 120 260 120 C 245 120 250 140 260 145 Z" fill="#22c55e" />
                
                <!-- Follaje superior joven -->
                <circle cx="200" cy="90" r="32" fill="#22c55e" opacity="0.95" />
                <circle cx="180" cy="85" r="24" fill="#16a34a" opacity="0.9" />
                <circle cx="220" cy="85" r="24" fill="#4ade80" opacity="0.9" />

                <!-- ORUGA ANIMADA 1 (en la rama izquierda) -->
                <g class="animated-caterpillar-left" transform="translate(150, 160)">
                    <circle cx="0" cy="0" r="4.5" fill="#84cc16" />
                    <circle cx="6" cy="-2" r="4" fill="#65a30d" />
                    <circle cx="12" cy="0" r="4" fill="#84cc16" />
                    <circle cx="18" cy="-2" r="4" fill="#65a30d" />
                    <!-- Cabeza con ojitos y antenas -->
                    <circle cx="23" cy="-3" r="5" fill="#4d7c0f" />
                    <circle cx="24" cy="-4" r="1" fill="#ffffff" />
                    <path d="M 24 -7 Q 26 -11 28 -10" stroke="#365314" stroke-width="1" fill="none" />
                </g>

                <!-- ORUGA ANIMADA 2 (en el tallo central subiendo) -->
                <g class="animated-caterpillar-stem" transform="translate(195, 210) rotate(-75)">
                    <circle cx="0" cy="0" r="4" fill="#a3e635" />
                    <circle cx="5" cy="-2" r="3.8" fill="#84cc16" />
                    <circle cx="10" cy="0" r="3.8" fill="#a3e635" />
                    <circle cx="15" cy="-2" r="4.5" fill="#65a30d" />
                    <circle cx="16" cy="-3" r="1" fill="#ffffff" />
                </g>
            `;
        } else if (etapa.nivel === 3) {
            // ETAPA 3: Árbol joven con follaje verde y mariposas revoloteando
            svgContent = `
                <!-- Suelo -->
                <ellipse cx="200" cy="275" rx="150" ry="24" fill="#3f2719" />
                <ellipse cx="200" cy="270" rx="125" ry="18" fill="#5c3822" />
                <path d="M 120 270 Q 200 258 280 270 Q 200 282 120 270 Z" fill="#15803d" opacity="0.6" />

                <!-- Tronco del árbol -->
                <path d="M 190 270 Q 188 200 193 140 Q 170 120 150 100 M 193 140 Q 200 105 200 70 M 193 140 Q 218 115 245 95 M 207 270 Q 209 200 207 140" 
                    stroke="#78350f" stroke-width="14" stroke-linecap="round" fill="none" />
                <path d="M 192 270 L 208 270 L 202 140 L 195 140 Z" fill="#78350f" />
                
                <!-- Copa de follaje esmeralda multicapa -->
                <g class="tree-canopy-layer">
                    <circle cx="200" cy="85" r="55" fill="#15803d" />
                    <circle cx="155" cy="100" r="42" fill="#16a34a" />
                    <circle cx="245" cy="100" r="42" fill="#16a34a" />
                    <circle cx="175" cy="65" r="38" fill="#22c55e" />
                    <circle cx="225" cy="65" r="38" fill="#4ade80" opacity="0.9" />
                    <circle cx="200" cy="60" r="35" fill="#86efac" opacity="0.5" />
                </g>

                <!-- MARIPOSA 1 (Azul vibrante revoloteando) -->
                <g class="animated-butterfly-1">
                    <g transform="translate(130, 70)">
                        <path d="M 0 0 C -12 -15 -20 0 -5 5 C -20 15 -10 25 0 8 Z" fill="#38bdf8" />
                        <path d="M 0 0 C 12 -15 20 0 5 5 C 20 15 10 25 0 8 Z" fill="#0284c7" />
                        <line x1="0" y1="-4" x2="0" y2="10" stroke="#0f172a" stroke-width="1.5" />
                    </g>
                </g>

                <!-- MARIPOSA 2 (Naranja monarca revoloteando) -->
                <g class="animated-butterfly-2">
                    <g transform="translate(260, 95)">
                        <path d="M 0 0 C -10 -12 -16 0 -4 4 C -16 12 -8 20 0 6 Z" fill="#fb923c" />
                        <path d="M 0 0 C 10 -12 16 0 4 4 C 16 12 8 20 0 6 Z" fill="#ea580c" />
                        <line x1="0" y1="-3" x2="0" y2="8" stroke="#0f172a" stroke-width="1.5" />
                    </g>
                </g>

                <!-- MARIPOSA 3 (Amarilla dorada) -->
                <g class="animated-butterfly-3">
                    <g transform="translate(200, 35)">
                        <path d="M 0 0 C -8 -10 -14 0 -3 3 C -14 10 -6 16 0 5 Z" fill="#fde047" />
                        <path d="M 0 0 C 8 -10 14 0 3 3 C 14 10 6 16 0 5 Z" fill="#eab308" />
                        <line x1="0" y1="-2" x2="0" y2="6" stroke="#0f172a" stroke-width="1" />
                    </g>
                </g>
            `;
        } else if (etapa.nivel === 4) {
            // ETAPA 4: Árbol frondoso con ardillas animadas en las ramas
            svgContent = `
                <!-- Suelo con flores y hierba -->
                <ellipse cx="200" cy="275" rx="160" ry="25" fill="#3f2719" />
                <ellipse cx="200" cy="270" rx="140" ry="18" fill="#14532d" />
                <circle cx="110" cy="270" r="3" fill="#fde047" />
                <circle cx="280" cy="268" r="3.5" fill="#f43f5e" />
                <circle cx="295" cy="272" r="3" fill="#38bdf8" />

                <!-- Tronco robusto y corteza texturizada -->
                <path d="M 182 270 Q 185 190 190 130 Q 140 100 110 80 M 190 130 Q 200 90 200 50 M 190 130 Q 240 95 285 80 M 218 270 Q 215 190 210 130" 
                    stroke="#5c2b09" stroke-width="22" stroke-linecap="round" fill="none" />
                <path d="M 180 270 L 220 270 L 210 130 L 190 130 Z" fill="#5c2b09" />
                <path d="M 195 240 Q 200 180 195 150" stroke="#451a03" stroke-width="2" fill="none" />
                <path d="M 205 250 Q 202 200 207 160" stroke="#451a03" stroke-width="2" fill="none" />

                <!-- Copa majestuosa frondosa -->
                <g class="tree-canopy-frondoso">
                    <circle cx="200" cy="80" r="75" fill="#14532d" />
                    <circle cx="140" cy="95" r="60" fill="#15803d" />
                    <circle cx="260" cy="95" r="60" fill="#15803d" />
                    <circle cx="170" cy="55" r="55" fill="#16a34a" />
                    <circle cx="230" cy="55" r="55" fill="#22c55e" />
                    <circle cx="200" cy="40" r="45" fill="#4ade80" opacity="0.85" />
                    <circle cx="130" cy="120" r="35" fill="#15803d" />
                    <circle cx="270" cy="120" r="35" fill="#15803d" />
                </g>

                <!-- ARDILLA 1 (en la rama izquierda, comiendo una bellota) -->
                <g class="animated-squirrel-1" transform="translate(135, 95)">
                    <!-- Cola esponjosa animada -->
                    <path class="squirrel-tail" d="M -8 10 Q -24 0 -22 -18 Q -20 -30 -8 -25 Q 2 -20 -4 -8 Z" fill="#b45309" />
                    <!-- Cuerpo -->
                    <ellipse cx="4" cy="5" rx="9" ry="12" fill="#d97706" />
                    <!-- Pecho crema -->
                    <ellipse cx="8" cy="7" rx="5" ry="8" fill="#fef3c7" />
                    <!-- Cabeza -->
                    <circle cx="8" cy="-8" r="7" fill="#d97706" />
                    <!-- Oreja -->
                    <path d="M 6 -15 L 8 -19 L 10 -15 Z" fill="#b45309" />
                    <!-- Ojito -->
                    <circle cx="11" cy="-8" r="1.5" fill="#000000" />
                    <!-- Bellota en manitas -->
                    <ellipse cx="14" cy="-2" rx="3.5" ry="4.5" fill="#78350f" />
                    <path d="M 12 -4 Q 14 -7 16 -4 Z" fill="#451a03" />
                </g>

                <!-- ARDILLA 2 (en la rama derecha subiendo curiosa) -->
                <g class="animated-squirrel-2" transform="translate(255, 90) scale(-1, 1)">
                    <path class="squirrel-tail-2" d="M -6 8 Q -20 -2 -18 -16 Q -16 -26 -6 -22 Q 2 -18 -3 -6 Z" fill="#b45309" />
                    <ellipse cx="3" cy="4" rx="8" ry="11" fill="#d97706" />
                    <ellipse cx="6" cy="5" rx="4" ry="7" fill="#fef3c7" />
                    <circle cx="7" cy="-7" r="6.5" fill="#d97706" />
                    <path d="M 5 -13 L 7 -17 L 9 -13 Z" fill="#b45309" />
                    <circle cx="9" cy="-7" r="1.3" fill="#000000" />
                </g>
            `;
        } else if (etapa.nivel === 5) {
            // ETAPA 5: Árbol maduro repleto de frutos brillantes y destellos
            svgContent = `
                <!-- Suelo con resplandor dorado -->
                <ellipse cx="200" cy="275" rx="170" ry="25" fill="#3f2719" />
                <ellipse cx="200" cy="270" rx="150" ry="18" fill="#14532d" />
                <ellipse cx="200" cy="270" rx="100" ry="10" fill="#eab308" opacity="0.25" class="golden-soil-glow" />

                <!-- Tronco anciano fuerte y majestuoso -->
                <path d="M 180 270 Q 185 180 190 120 Q 130 90 90 70 M 190 120 Q 200 80 200 40 M 190 120 Q 250 85 305 70 M 220 270 Q 215 180 210 120" 
                    stroke="#451a03" stroke-width="26" stroke-linecap="round" fill="none" />
                <path d="M 175 270 L 225 270 L 212 120 L 188 120 Z" fill="#451a03" />

                <!-- Copa exuberante de gran volumen -->
                <g class="tree-canopy-maduro">
                    <circle cx="200" cy="75" r="85" fill="#14532d" />
                    <circle cx="130" cy="90" r="70" fill="#15803d" />
                    <circle cx="270" cy="90" r="70" fill="#15803d" />
                    <circle cx="165" cy="45" r="65" fill="#16a34a" />
                    <circle cx="235" cy="45" r="65" fill="#22c55e" />
                    <circle cx="200" cy="30" r="55" fill="#4ade80" opacity="0.9" />
                </g>

                <!-- FRUTOS DORADOS Y ROJOS BRILLANTES (Pulsantes con resplandor) -->
                <g class="tree-fruits-group">
                    <!-- Fruto 1 -->
                    <g class="pulsing-fruit" transform="translate(135, 75)">
                        <circle cx="0" cy="0" r="10" fill="url(#fruitGlow1)" filter="drop-shadow(0 0 6px #f59e0b)" />
                        <circle cx="-3" cy="-3" r="2.5" fill="#fef08a" />
                        <path d="M 0 -10 Q 2 -14 4 -12" stroke="#15803d" stroke-width="1.5" fill="none" />
                    </g>
                    <!-- Fruto 2 -->
                    <g class="pulsing-fruit" transform="translate(175, 45)" style="animation-delay: 0.3s;">
                        <circle cx="0" cy="0" r="11" fill="url(#fruitGlow1)" filter="drop-shadow(0 0 8px #eab308)" />
                        <circle cx="-3" cy="-3" r="3" fill="#fef08a" />
                    </g>
                    <!-- Fruto 3 -->
                    <g class="pulsing-fruit" transform="translate(225, 40)" style="animation-delay: 0.6s;">
                        <circle cx="0" cy="0" r="11.5" fill="url(#fruitGlow1)" filter="drop-shadow(0 0 8px #f59e0b)" />
                        <circle cx="-3" cy="-3" r="3" fill="#fef08a" />
                    </g>
                    <!-- Fruto 4 -->
                    <g class="pulsing-fruit" transform="translate(265, 80)" style="animation-delay: 0.9s;">
                        <circle cx="0" cy="0" r="10" fill="url(#fruitGlow1)" filter="drop-shadow(0 0 6px #eab308)" />
                        <circle cx="-3" cy="-3" r="2.5" fill="#fef08a" />
                    </g>
                    <!-- Fruto 5 -->
                    <g class="pulsing-fruit" transform="translate(160, 110)" style="animation-delay: 0.4s;">
                        <circle cx="0" cy="0" r="9.5" fill="url(#fruitGlow2)" filter="drop-shadow(0 0 6px #ef4444)" />
                        <circle cx="-2" cy="-2" r="2" fill="#fee2e2" />
                    </g>
                    <!-- Fruto 6 -->
                    <g class="pulsing-fruit" transform="translate(240, 110)" style="animation-delay: 0.7s;">
                        <circle cx="0" cy="0" r="10" fill="url(#fruitGlow1)" filter="drop-shadow(0 0 7px #eab308)" />
                        <circle cx="-3" cy="-3" r="2.5" fill="#fef08a" />
                    </g>
                    <!-- Fruto 7 Central Cumbre -->
                    <g class="pulsing-fruit" transform="translate(200, 20)" style="animation-delay: 0.2s;">
                        <circle cx="0" cy="0" r="13" fill="url(#fruitGlow1)" filter="drop-shadow(0 0 10px #fbbf24)" />
                        <circle cx="-4" cy="-4" r="3.5" fill="#ffffff" />
                    </g>
                </g>

                <!-- Destellos y chispas de luz estelar -->
                <g class="tree-sparkles">
                    <path d="M 120 40 L 122 45 L 127 47 L 122 49 L 120 54 L 118 49 L 113 47 L 118 45 Z" fill="#fef08a" class="sparkle-anim-1" />
                    <path d="M 280 45 L 282 50 L 287 52 L 282 54 L 280 59 L 278 54 L 273 52 L 278 50 Z" fill="#fde047" class="sparkle-anim-2" />
                    <path d="M 195 90 L 197 94 L 201 95 L 197 96 L 195 100 L 193 96 L 189 95 L 193 94 Z" fill="#ffffff" class="sparkle-anim-3" />
                </g>
            `;
        } else {
            // ETAPA 6: 100% META ALCANZADA - Cosecha Dorada, Semilla que cae y Premio Liberado
            svgContent = `
                <!-- Aura Dorada Celestial de Fondo -->
                <circle cx="200" cy="110" r="130" fill="url(#goldenAuraGradient)" class="golden-celebration-aura" />

                <!-- Suelo enriquecido bañado en oro -->
                <ellipse cx="200" cy="275" rx="175" ry="25" fill="#3f2719" />
                <ellipse cx="200" cy="270" rx="155" ry="18" fill="#713f12" />
                <ellipse cx="200" cy="268" rx="130" ry="12" fill="#ca8a04" opacity="0.6" />

                <!-- Tronco Divino con Vetas Doradas -->
                <path d="M 178 270 Q 185 180 190 120 Q 125 90 85 70 M 190 120 Q 200 75 200 35 M 190 120 Q 255 85 315 70 M 222 270 Q 215 180 210 120" 
                    stroke="#451a03" stroke-width="28" stroke-linecap="round" fill="none" />
                <path d="M 172 270 L 228 270 L 214 120 L 186 120 Z" fill="#451a03" />
                <!-- Vetas de luz dorada en el tronco -->
                <path d="M 193 265 Q 198 190 194 135" stroke="#fde047" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.9" />
                <path d="M 207 265 Q 203 190 206 135" stroke="#fde047" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.9" />

                <!-- Copa Dorada & Esmeralda Majestuosa -->
                <g class="tree-canopy-golden-god">
                    <circle cx="200" cy="70" r="90" fill="#15803d" />
                    <circle cx="125" cy="85" r="75" fill="#16a34a" />
                    <circle cx="275" cy="85" r="75" fill="#16a34a" />
                    <circle cx="160" cy="40" r="70" fill="#22c55e" />
                    <circle cx="240" cy="40" r="70" fill="#4ade80" />
                    <circle cx="200" cy="20" r="60" fill="#fde047" opacity="0.4" />
                </g>

                <!-- LLUVIA DE CONFETI Y ESTRELLAS DORADAS -->
                <g class="celebration-confetti">
                    <circle cx="90" cy="60" r="3" fill="#f59e0b" class="confetti-fall-1" />
                    <circle cx="140" cy="30" r="4" fill="#fbbf24" class="confetti-fall-2" />
                    <circle cx="260" cy="25" r="3.5" fill="#fde047" class="confetti-fall-3" />
                    <circle cx="310" cy="55" r="4" fill="#f59e0b" class="confetti-fall-1" />
                    <polygon points="170,15 173,22 180,22 174,26 176,33 170,29 164,33 166,26 160,22 167,22" fill="#fde047" class="star-burst-1" />
                    <polygon points="230,15 233,22 240,22 234,26 236,33 230,29 224,33 226,26 220,22 227,22" fill="#fbbf24" class="star-burst-2" />
                </g>

                <!-- ANIMACIÓN DE LA SEMILLA DORADA CAYENDO AL SUELO -->
                <g class="golden-seed-drop-animation">
                    <!-- Destello brillante alrededor de la semilla -->
                    <circle cx="200" cy="180" r="18" fill="#fef08a" opacity="0.4" class="seed-aura" />
                    <!-- Semilla Dorada Cosechada -->
                    <path d="M 200 168 C 190 178 188 192 200 198 C 212 192 210 178 200 168 Z" fill="url(#seedGoldGradient)" filter="drop-shadow(0 4px 12px rgba(234, 179, 8, 0.9))" />
                    <circle cx="197" cy="180" r="3" fill="#ffffff" />
                </g>

                <!-- Brote nuevo germinando del suelo preparado para el siguiente ciclo -->
                <g class="new-cycle-sprout-preview" transform="translate(200, 260)">
                    <path d="M 0 0 Q -3 -8 0 -14" stroke="#86efac" stroke-width="2.5" fill="none" />
                    <circle cx="-3" cy="-14" r="2.5" fill="#4ade80" />
                    <circle cx="3" cy="-14" r="2.5" fill="#22c55e" />
                </g>
            `;
        }

        return `
            <svg viewBox="0 0 400 320" width="100%" height="100%" class="tree-growth-svg" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <!-- Gradientes para Frutos y Auras -->
                    <radialGradient id="fruitGlow1" cx="35%" cy="35%" r="65%">
                        <stop offset="0%" stop-color="#fef08a" />
                        <stop offset="40%" stop-color="#f59e0b" />
                        <stop offset="100%" stop-color="#b45309" />
                    </radialGradient>
                    <radialGradient id="fruitGlow2" cx="35%" cy="35%" r="65%">
                        <stop offset="0%" stop-color="#fee2e2" />
                        <stop offset="40%" stop-color="#ef4444" />
                        <stop offset="100%" stop-color="#991b1b" />
                    </radialGradient>
                    <radialGradient id="goldenAuraGradient" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#fef08a" stop-opacity="0.6" />
                        <stop offset="60%" stop-color="#f59e0b" stop-opacity="0.25" />
                        <stop offset="100%" stop-color="#eab308" stop-opacity="0" />
                    </radialGradient>
                    <linearGradient id="seedGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff" />
                        <stop offset="30%" stop-color="#fef08a" />
                        <stop offset="70%" stop-color="#eab308" />
                        <stop offset="100%" stop-color="#a16207" />
                    </linearGradient>
                </defs>

                <!-- Cielo / Fondo atmosférico sutil -->
                <rect x="0" y="0" width="400" height="320" rx="16" fill="url(#skyGradient)" />
                <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#f0fdf4" />
                    <stop offset="60%" stop-color="#dcfce7" />
                    <stop offset="100%" stop-color="#bbf7d0" />
                </linearGradient>

                ${svgContent}
            </svg>
        `;
    }

    /**
     * Renderiza el Widget completo en el contenedor DOM especificado
     */
    render(puntos = 0, meta = 200, premio = null, ciclo = 1, targetContainerId = null) {
        if (targetContainerId) this.containerId = targetContainerId;
        this.puntosActuales = Number(puntos) || 0;
        this.puntosMeta = Number(meta) || 200;
        this.premioActual = premio || AppState.premioMes || { nombre: 'Premio del Mes', puntosRequeridos: meta };
        this.nivelCiclo = ciclo || 1;

        this.porcentaje = Math.min(100, Math.round((this.puntosActuales / this.puntosMeta) * 100));

        const container = document.getElementById(this.containerId) || document.getElementById('tree-gamification-root') || document.getElementById('tree-gamification-container');
        if (!container) return;

        const etapa = this.obtenerEtapa(this.porcentaje);
        const puntosFaltantes = Math.max(0, this.puntosMeta - this.puntosActuales);
        const metaAlcanzada = this.porcentaje >= 100;

        container.innerHTML = `
            <div class="tree-gamification-card" style="background:#ffffff; border:1px solid var(--border); border-radius:16px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(0,0,0,0.06);">
                <!-- Encabezado del Widget -->
                <div style="background:linear-gradient(135deg, #064e3b, #047857); color:#ffffff; padding:18px 22px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:1.4rem;">${etapa.icono}</span>
                            <h3 style="margin:0; font-size:1.2rem; color:#ffffff; font-weight:700;">Árbol de Crecimiento y Fidelidad</h3>
                            <span class="badge-pill" style="background:#fef08a; color:#854d0e; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:12px;">
                                Ciclo #${this.nivelCiclo}
                            </span>
                        </div>
                        <p style="margin:4px 0 0 0; font-size:0.85rem; color:#d1fae5;">
                            ${etapa.titulo} · <span style="color:#fde047; font-weight:600;">${etapa.rango}</span>
                        </p>
                    </div>

                    <!-- Píldora de Puntos -->
                    <div style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:12px; padding:6px 14px; text-align:right;">
                        <div style="font-size:0.75rem; color:#a7f3d0; text-transform:uppercase;">Puntos del Mes</div>
                        <strong style="font-size:1.2rem; color:#fde047;">${this.puntosActuales} <span style="font-size:0.85rem; color:#ffffff;">/ ${this.puntosMeta} pts</span></strong>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr; gap:0;">
                    <!-- Canvas SVG del Árbol -->
                    <div style="position:relative; width:100%; height:320px; background:#f0fdf4; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        ${this.generarSVGArbol(this.porcentaje)}
                        
                        <!-- Badge flotante de estado en el árbol -->
                        <div style="position:absolute; top:12px; left:14px; background:rgba(255,255,255,0.92); backdrop-filter:blur(6px); border:1px solid #cbd5e1; border-radius:20px; padding:4px 12px; font-size:0.78rem; font-weight:700; color:#0f172a; display:flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${etapa.color};"></span>
                            <span>${etapa.titulo}</span>
                        </div>

                        <!-- Indicador porcentual flotante -->
                        <div style="position:absolute; top:12px; right:14px; background:rgba(15, 23, 42, 0.85); color:#ffffff; border-radius:20px; padding:4px 12px; font-size:0.82rem; font-weight:800; display:flex; align-items:center; gap:4px; box-shadow:0 2px 6px rgba(0,0,0,0.15);">
                            <i class="fas fa-chart-line" style="color:#fde047; font-size:0.75rem;"></i>
                            <span>${this.porcentaje}%</span>
                        </div>

                        ${metaAlcanzada ? `
                            <div class="meta-alcanzada-banner" style="position:absolute; bottom:16px; background:linear-gradient(135deg, #eab308, #ca8a04); color:#ffffff; padding:8px 18px; border-radius:30px; font-weight:800; font-size:0.9rem; display:flex; align-items:center; gap:8px; box-shadow:0 6px 20px rgba(202, 138, 4, 0.4); animation: pulseBanner 1.5s infinite;">
                                <i class="fas fa-crown" style="font-size:1.1rem; color:#ffffff;"></i>
                                <span>¡Cosecha Dorada Lista! Reclama tu premio</span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Panel de Control y Progreso de Etapas -->
                    <div style="padding:20px 22px;">
                        <!-- Barra de Progreso Multi-Hito -->
                        <div style="margin-bottom:18px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:0.86rem;">
                                <span style="font-weight:600; color:var(--text-main);">Progreso hacia el Premio: <strong>${this.premioActual.nombre}</strong></span>
                                <strong style="color:${etapa.color};">${this.porcentaje}%</strong>
                            </div>

                            <div style="position:relative; width:100%; height:12px; background:#e2e8f0; border-radius:10px; overflow:hidden;">
                                <div style="width:${this.porcentaje}%; height:100%; background:linear-gradient(90deg, #16a34a, #eab308); border-radius:10px; transition:width 0.6s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                            </div>

                            <!-- Marcadores de Hitos (20%, 40%, 60%, 80%, 100%) -->
                            <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:0.72rem; color:var(--text-muted); font-weight:600;">
                                <span style="color:${this.porcentaje >= 0 ? '#16a34a' : 'inherit'};">🌱 0%</span>
                                <span style="color:${this.porcentaje >= 20 ? '#65a30d' : 'inherit'};">🐛 20%</span>
                                <span style="color:${this.porcentaje >= 40 ? '#059669' : 'inherit'};">🦋 40%</span>
                                <span style="color:${this.porcentaje >= 60 ? '#047857' : 'inherit'};">🐿️ 60%</span>
                                <span style="color:${this.porcentaje >= 80 ? '#d97706' : 'inherit'};">🍎 80%</span>
                                <span style="color:${this.porcentaje >= 100 ? '#eab308' : 'inherit'};">🌟 100%</span>
                            </div>
                        </div>

                        <!-- Tarjeta Explicativa de la Etapa -->
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:4px solid ${etapa.color}; border-radius:0 10px 10px 0; padding:12px 14px; margin-bottom:16px; font-size:0.86rem; color:var(--text-main); line-height:1.4;">
                            <strong style="color:${etapa.color}; display:block; margin-bottom:2px;">${etapa.subtitulo}</strong>
                            ${etapa.descripcion}
                        </div>

                        <!-- Acciones y Botón de Reclamar / Ciclo -->
                        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                            ${metaAlcanzada ? `
                                <button type="button" class="btn btn-block btn-success btn-canjear-glow" onclick="InventoryApp.TreeGamification.reclamarPremioYCiclo()" style="flex:2; min-width:220px; font-weight:800; font-size:0.95rem; padding:12px; background:linear-gradient(135deg, #16a34a, #15803d); box-shadow:0 4px 15px rgba(22, 163, 74, 0.35);">
                                    <i class="fas fa-gift"></i> ¡Reclamar ${this.premioActual.nombre} & Iniciar Ciclo #${this.nivelCiclo + 1}!
                                </button>
                            ` : `
                                <button type="button" class="btn btn-block btn-secondary" disabled style="flex:2; min-width:220px; font-weight:600; padding:10px;">
                                    <i class="fas fa-lock"></i> Faltan ${puntosFaltantes} puntos para la Cosecha Dorada
                                </button>
                            `}

                            <button type="button" class="btn btn-outline btn-sm" onclick="InventoryApp.TreeGamification.toggleSimulador()" style="flex:1; min-width:140px; font-size:0.78rem;">
                                <i class="fas fa-flask"></i> Probar Etapas
                            </button>
                        </div>

                        <!-- Simulador Interactivo para Pruebas UI -->
                        <div id="tree-simulador-panel" style="display:${this.simulacionActiva ? 'block' : 'none'}; margin-top:14px; padding:12px; background:#f1f5f9; border-radius:8px; border:1px dashed #cbd5e1;">
                            <div style="font-size:0.78rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">🧪 Simulador de Crecimiento del Árbol (Preview de Etapas):</div>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                <button type="button" class="btn btn-xs btn-outline" onclick="InventoryApp.TreeGamification.simularPorcentaje(10)">0-19% (Brote)</button>
                                <button type="button" class="btn btn-xs btn-outline" onclick="InventoryApp.TreeGamification.simularPorcentaje(30)">20-39% (Orugas)</button>
                                <button type="button" class="btn btn-xs btn-outline" onclick="InventoryApp.TreeGamification.simularPorcentaje(50)">40-59% (Mariposas)</button>
                                <button type="button" class="btn btn-xs btn-outline" onclick="InventoryApp.TreeGamification.simularPorcentaje(70)">60-79% (Ardillas)</button>
                                <button type="button" class="btn btn-xs btn-outline" onclick="InventoryApp.TreeGamification.simularPorcentaje(90)">80-99% (Frutos)</button>
                                <button type="button" class="btn btn-xs btn-warning" onclick="InventoryApp.TreeGamification.simularPorcentaje(100)">100% (Semilla Dorada)</button>
                                <button type="button" class="btn btn-xs btn-primary" onclick="InventoryApp.TreeGamification.restaurarReal()">Valores Reales</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    simularPorcentaje(pct) {
        this.simulacionActiva = true;
        const ptsSimulados = Math.round((pct / 100) * this.puntosMeta);
        this.render(ptsSimulados, this.puntosMeta, this.premioActual, this.nivelCiclo);
    }

    restaurarReal() {
        this.simulacionActiva = false;
        const usuario = AppState.usuarioActual;
        const pts = usuario ? (Number(usuario.puntosAcumulados || 0) - Number(usuario.puntosCanjeados || 0)) : 0;
        const meta = Number(AppState.premioMes?.puntosRequeridos || 200);
        this.render(pts, meta, AppState.premioMes, this.nivelCiclo);
    }

    toggleSimulador() {
        this.simulacionActiva = !this.simulacionActiva;
        const panel = document.getElementById('tree-simulador-panel');
        if (panel) {
            panel.style.display = this.simulacionActiva ? 'block' : 'none';
        }
    }

    /**
     * Reclama el premio del mes, libera la recompensa y reinicia automáticamente un nuevo ciclo
     */
    async reclamarPremioYCiclo() {
        const usuario = AppState.usuarioActual;
        if (!usuario) return;

        const pm = AppState.premioMes || { nombre: 'Premio del Mes', puntosRequeridos: 200 };
        const puntosRequeridos = Number(pm.puntosRequeridos || 200);

        if (!confirm(`🎉 ¡Felicidades, ${usuario.nombre}!\n\n¿Deseas canjear tus ${puntosRequeridos} puntos y reclamar el premio:\n"${pm.nombre}"?\n\nAl reclamarlo, se descontarán los puntos de la meta y tu Árbol de Crecimiento germinará una nueva Semilla Dorada para el siguiente ciclo de premios.`)) {
            return;
        }

        // Registrar canje
        if (!Array.isArray(AppState.canjesPremios)) AppState.canjesPremios = [];
        const nuevoCanje = {
            id: 'CANJE_' + Date.now().toString().slice(-6),
            clienteCedula: usuario.cedula || usuario.id,
            clienteNombre: usuario.nombre,
            premioNombre: pm.nombre,
            puntos: puntosRequeridos,
            fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
            estado: 'ENTREGADO',
            cicloCompletado: this.nivelCiclo
        };

        AppState.canjesPremios.push(nuevoCanje);

        // Descontar puntos canjeados
        usuario.puntosCanjeados = Number(usuario.puntosCanjeados || 0) + puntosRequeridos;
        usuario.cicloGamificacion = (Number(usuario.cicloGamificacion) || 1) + 1;
        this.nivelCiclo = usuario.cicloGamificacion;

        // Persistir en servidor y local
        if (window.InventoryApp.Persistence) window.InventoryApp.Persistence.guardar(true);
        if (window.InventoryApp.Firebase && typeof window.InventoryApp.Firebase.guardarUsuario === 'function') {
            window.InventoryApp.Firebase.guardarUsuario(usuario);
        }

        // Llamar API de lealtad si está disponible
        try {
            await fetch('/api/loyalty/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: usuario.cedula || usuario.id, premioId: pm.nombre, puntos: puntosRequeridos })
            });
        } catch {
            // Continuar con persistencia local garantizada
        }

        alert(`🏆 ¡PREMIO RECLAMADO CON ÉXITO!\n\nHas obtenido: "${pm.nombre}".\nTu comprobante es #${nuevoCanje.id}.\n\nTu Árbol de Crecimiento ha liberado su semilla y comienza el Ciclo #${this.nivelCiclo}. ¡Sigue acumulando puntos!`);

        // Re-renderizar
        if (typeof renderizarPremioMesCliente === 'function') renderizarPremioMesCliente();
        if (typeof renderizarCatalogoCliente === 'function') renderizarCatalogoCliente();
    }
}

// Instancia global
window.InventoryApp.TreeGamification = new TreeGamificationWidget('tree-gamification-container');
