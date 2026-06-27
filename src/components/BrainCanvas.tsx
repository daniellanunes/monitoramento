"use client";

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SiteData } from '@/types/monitor';

interface BrainMeshProps {
  sites: SiteData[];
  onSelectSite: (site: SiteData) => void;
  selectedSiteId?: number | null;
}

// Pure deterministic pseudo-random helper to comply with React render purity rules
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

interface SiteNodeProps {
  site: SiteData;
  onSelectSite: (site: SiteData) => void;
  isSelected?: boolean;
}

function SiteNode({ site, onSelectSite, isSelected }: SiteNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const serverWireframeRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = React.useState(false);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const isOnline = site.status === 'online';
    
    // Slow scale pulse on hover or state
    if (meshRef.current) {
      const scaleMultiplier = isSelected ? 1.6 : hovered ? 1.35 : 1.0;
      const pulse = 1 + Math.sin(t * 6) * 0.06;
      meshRef.current.scale.setScalar(scaleMultiplier * pulse);
    }
    
    // Expanding glowing halo
    if (glowRef.current) {
      const speed = isOnline ? 0.8 : 0.5;
      const progress = (t * speed) % 1; // 0 to 1
      glowRef.current.scale.setScalar(1.1 + progress * 1.6);
      
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = (1 - progress) * 0.4;
      }
    }

    // Large beacon ring for selected node
    if (beaconRef.current) {
      if (isSelected) {
        const speed = 1.2;
        const progress = (t * speed) % 1;
        beaconRef.current.scale.setScalar(1.5 + progress * 3.5);
        const mat = beaconRef.current.material as THREE.MeshBasicMaterial;
        if (mat) mat.opacity = (1 - progress) * 0.7;
        beaconRef.current.visible = true;
      } else {
        beaconRef.current.visible = false;
      }
    }

    // Rotating ring around hovered/selected node
    if (ringRef.current) {
      if (isSelected || hovered) {
        ringRef.current.visible = true;
        ringRef.current.rotation.z += delta * 1.2;
        ringRef.current.rotation.x = Math.sin(t * 1.5) * 0.2;
        ringRef.current.rotation.y = Math.cos(t * 1.5) * 0.2;
        
        const s = (isSelected ? 1.4 : 1.15) + Math.sin(t * 8) * 0.04;
        ringRef.current.scale.setScalar(s);
      } else {
        ringRef.current.visible = false;
      }
    }

    // Spin the server outer wireframe
    if (serverWireframeRef.current) {
      serverWireframeRef.current.rotation.y += delta * 0.35;
      serverWireframeRef.current.rotation.x += delta * 0.15;
    }
  });

  const isOnline = site.status === 'online';
  const isServer = site.type === 'server';
  const coreSize = isServer ? 0.13 : 0.075;
  const color = isOnline ? (isServer ? '#00d2ff' : '#a855f7') : '#ff3366';
  const emissiveColor = color;
  const beaconColor = isSelected ? '#ffffff' : color;

  return (
    <group position={site.position as [number, number, number]}>
      {/* Selected beacon outer ring */}
      <mesh ref={beaconRef} visible={false}>
        {isServer ? (
          <icosahedronGeometry args={[coreSize * 1.6, 1]} />
        ) : (
          <sphereGeometry args={[coreSize * 1.6, 16, 16]} />
        )}
        <meshBasicMaterial
          color={beaconColor}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Sleek rotating ring around node */}
      <mesh ref={ringRef} visible={false}>
        <ringGeometry args={[coreSize * 1.35, coreSize * 1.45, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Server Wireframe Orbit Shield */}
      {isServer && (
        <mesh ref={serverWireframeRef}>
          <icosahedronGeometry args={[coreSize * 1.32, 1]} />
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={0.25}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Site Core */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelectSite(site);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        {isServer ? (
          <icosahedronGeometry args={[coreSize, 1]} />
        ) : (
          <sphereGeometry args={[coreSize, 32, 32]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={isSelected ? 5.0 : hovered ? 3.5 : isServer ? 2.5 : 1.5}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Pulsing Sonar Halo */}
      <mesh ref={glowRef}>
        {isServer ? (
          <icosahedronGeometry args={[coreSize * 1.4, 1]} />
        ) : (
          <sphereGeometry args={[coreSize * 1.4, 16, 16]} />
        )}
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Floating 3D label when hovered OR selected */}
      {(hovered || isSelected) && (
        <Html distanceFactor={4.5} position={[0, 0.32, 0]} center>
          <div 
            className="px-3.5 py-2 rounded-xl text-[10px] whitespace-nowrap pointer-events-none text-white border shadow-2xl flex items-center gap-2 font-sans tracking-wide"
            style={{
              background: 'rgba(9, 10, 15, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderColor: isSelected 
                ? 'rgba(255, 255, 255, 0.4)' 
                : `${color}40`,
              boxShadow: isSelected 
                ? `0 0 20px rgba(255, 255, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2)`
                : `0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px ${color}33`,
              transition: 'all 0.3s ease',
            }}
          >
            {/* Status indicator dot */}
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isOnline ? (isServer ? 'bg-[#00d2ff]' : 'bg-[#a855f7]') : 'bg-[#ff3366]'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isOnline ? (isServer ? 'bg-[#00d2ff]' : 'bg-[#a855f7]') : 'bg-[#ff3366]'
              }`}></span>
            </span>
            
            <span className="font-bold tracking-wider">{site.name}</span>
            
            <span 
              className="px-2 py-0.5 rounded-md text-[8px] font-bold border font-mono tracking-wider"
              style={{
                backgroundColor: isOnline 
                  ? (isServer ? 'rgba(0, 210, 255, 0.1)' : 'rgba(168, 85, 247, 0.1)')
                  : 'rgba(255, 51, 102, 0.1)',
                color: color,
                borderColor: `${color}30`
              }}
            >
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
            
            <span 
              className="px-2 py-0.5 rounded-md text-[8px] font-bold border font-mono tracking-wider"
              style={{
                backgroundColor: isServer ? 'rgba(0, 210, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                color: isServer ? '#00d2ff' : '#9ca3af',
                borderColor: isServer ? 'rgba(0, 210, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)'
              }}
            >
              {isServer ? 'SERVIDOR' : 'SITE'}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

function BrainMesh({ sites, onSelectSite, selectedSiteId }: BrainMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Generate procedural network mesh structures in a clean motherboard matrix layout
  const { 
    nodePositions, 
    connectionsWithColors, 
    s2sPosArray, 
    s2sColArray, 
    s2cPosArray, 
    s2cColArray, 
    c2cPosArray, 
    c2cColArray, 
    activeNodesPointsArray
  } = useMemo(() => {
    // 1. Separate servers and sites
    const servers = sites.filter(s => s.type === 'server');
    const ordinarySites = sites.filter(s => (s.type || 'site') !== 'server');

    const positionsMap: Record<number, THREE.Vector3> = {};

    // 2. Position the servers in a central helical spine to prevent overlap
    servers.forEach((server, i) => {
      // Stack vertically over a wider range (-1.0 to 1.0)
      const y = servers.length > 1 
        ? -1.0 + (i / (servers.length - 1)) * 2.0
        : 0.0;
      
      // If there are multiple servers, spiral them around the central axis
      // to keep them separated and visually distinct.
      const r = servers.length > 2 ? 0.35 : 0.0;
      const angle = i * (Math.PI * 0.5); // 90 degree offset per step
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      
      positionsMap[server.id] = new THREE.Vector3(x, y, z);
    });

    // 3. Position the sites in 4 vertical columns arranged in a circle (Cilindro)
    const numColumns = 4;
    const columns: SiteData[][] = [[], [], [], []];
    ordinarySites.forEach((site, i) => {
      columns[i % numColumns].push(site);
    });

    const cylinderRadius = 1.6;
    columns.forEach((colSites, colIdx) => {
      const angle = (colIdx * Math.PI * 2) / numColumns;
      const x = Math.cos(angle) * cylinderRadius;
      const z = Math.sin(angle) * cylinderRadius;
      
      colSites.forEach((site, i) => {
        const y = colSites.length > 1
          ? -1.2 + (i / (colSites.length - 1)) * 2.4
          : 0.0;
        positionsMap[site.id] = new THREE.Vector3(x, y, z);
      });
    });

    // Helper color functions
    const getNodeColor = (site: SiteData) => {
      const isOnline = site.status === 'online';
      const isServer = site.type === 'server';
      return isOnline ? (isServer ? '#00d2ff' : '#a855f7') : '#ff3366';
    };

    const hexToRgb = (hex: string) => {
      const num = parseInt(hex.replace('#', ''), 16);
      return {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255
      };
    };

    // Connections
    const connectionsList: Array<{ start: THREE.Vector3; end: THREE.Vector3; destColor: string }> = [];
    const s2sPosList: number[] = [];
    const s2sColList: number[] = [];
    const s2cPosList: number[] = [];
    const s2cColList: number[] = [];
    const c2cPosList: number[] = [];
    const c2cColList: number[] = [];

    // Connect central servers sequentially to form the server spine
    for (let i = 0; i < servers.length - 1; i++) {
      const s1 = servers[i];
      const s2 = servers[i + 1];
      const p1 = positionsMap[s1.id];
      const p2 = positionsMap[s2.id];
      if (p1 && p2) {
        connectionsList.push({ start: p1, end: p2, destColor: getNodeColor(s2) });
        s2sPosList.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        const c1 = hexToRgb(getNodeColor(s1));
        const c2 = hexToRgb(getNodeColor(s2));
        s2sColList.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
      }
    }

    // Connect sites to their closest server in the central tower (horizontal circuit tracks)
    ordinarySites.forEach((site) => {
      const pSite = positionsMap[site.id];
      if (!pSite) return;

      let closestServer = servers[0];
      if (servers.length > 1) {
        let minDist = Infinity;
        servers.forEach((server) => {
          const pServer = positionsMap[server.id];
          if (pServer) {
            const dist = Math.abs(pSite.y - pServer.y);
            if (dist < minDist) {
              minDist = dist;
              closestServer = server;
            }
          }
        });
      }

      const pServer = positionsMap[closestServer?.id];
      if (pSite && pServer) {
        connectionsList.push({ start: pSite, end: pServer, destColor: getNodeColor(closestServer) });
        s2cPosList.push(pSite.x, pSite.y, pSite.z, pServer.x, pServer.y, pServer.z);
        
        const cSite = hexToRgb(getNodeColor(site));
        const cServer = hexToRgb(getNodeColor(closestServer));
        s2cColList.push(cSite.r, cSite.g, cSite.b, cServer.r, cServer.g, cServer.b);
      }
    });

    // Connect sites in each vertical cylinder column sequentially
    columns.forEach((colSites) => {
      for (let i = 0; i < colSites.length - 1; i++) {
        const s1 = colSites[i];
        const s2 = colSites[i + 1];
        const p1 = positionsMap[s1.id];
        const p2 = positionsMap[s2.id];
        if (p1 && p2) {
          connectionsList.push({ start: p1, end: p2, destColor: getNodeColor(s2) });
          c2cPosList.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
          const c1 = hexToRgb(getNodeColor(s1));
          const c2 = hexToRgb(getNodeColor(s2));
          c2cColList.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
        }
      }
    });

    // Active nodes points
    const activeNodesPoints: number[] = [];
    Object.keys(positionsMap).forEach((key) => {
      const pos = positionsMap[Number(key)];
      activeNodesPoints.push(pos.x, pos.y, pos.z);
    });

    return { 
      nodePositions: positionsMap, 
      connectionsWithColors: connectionsList,
      s2sPosArray: new Float32Array(s2sPosList),
      s2sColArray: new Float32Array(s2sColList),
      s2cPosArray: new Float32Array(s2cPosList),
      s2cColArray: new Float32Array(s2cColList),
      c2cPosArray: new Float32Array(c2cPosList),
      c2cColArray: new Float32Array(c2cColList),
      activeNodesPointsArray: new Float32Array(activeNodesPoints)
    };
  }, [sites]);

  // Setup animated data packet paths
  const packetsCount = 30; // slightly increased count for visually richer traffic
  const packetsRef = useRef<Array<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    color: string;
    size: number;
    progress: number;
    speed: number;
  }>>([]);
  const packetMeshRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Multi-axis rotation of the entire mesh for dynamic float effect
    if (groupRef.current && !selectedSiteId) {
      groupRef.current.rotation.y = t * 0.08;
      groupRef.current.rotation.x = Math.sin(t * 0.02) * 0.08;
    }

    // Initialize packets in animation frame to keep render pure
    if (packetsRef.current.length === 0 && connectionsWithColors.length > 0) {
      for (let i = 0; i < packetsCount; i++) {
        const conn = connectionsWithColors[Math.floor(Math.random() * connectionsWithColors.length)];
        packetsRef.current.push({
          start: conn.start,
          end: conn.end,
          color: conn.destColor,
          size: 0.015 + Math.random() * 0.02,
          progress: Math.random(),
          speed: 0.2 + Math.random() * 0.4,
        });
      }
    }

    // Animate individual data packets along network connections
    packetsRef.current.forEach((packet, idx) => {
      packet.progress += delta * packet.speed;
      if (packet.progress >= 1) {
        const conn = connectionsWithColors[Math.floor(Math.random() * connectionsWithColors.length)];
        packet.start = conn.start;
        packet.end = conn.end;
        packet.color = conn.destColor;
        packet.size = 0.015 + Math.random() * 0.02;
        packet.progress = 0;
        packet.speed = 0.2 + Math.random() * 0.4;
      }

      const mesh = packetMeshRefs.current[idx];
      if (mesh) {
        mesh.visible = true;
        mesh.position.lerpVectors(packet.start, packet.end, packet.progress);
        
        // Pulse size based on progress
        const scaleVal = packet.size * (1.0 + Math.sin(packet.progress * Math.PI) * 0.6);
        mesh.scale.setScalar(scaleVal);
        
        // Dynamically update material color
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (mat) {
          mat.color.set(packet.color);
        }
      }
    });
  });

  return (
    <>
      {/* 3D Holographic Cyber Grid Floor */}
      <gridHelper 
        args={[10, 20, '#a855f7', '#ffffff08']} 
        position={[0, -1.8, 0]} 
      />

      <group ref={groupRef}>
        {/* 1. Core Server-to-Server lines (Gradient lines) */}
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[s2sPosArray, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[s2sColArray, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.35}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>

        {/* 2. Site-to-Server radial spokes (Gradient lines) */}
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[s2cPosArray, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[s2cColArray, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>

        {/* 3. Site-to-Site connections (Geodesic shell gradient wireframe) */}
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[c2cPosArray, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[c2cColArray, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.08}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>

        {/* 4. Synapse points at active nodes (White core glow points) */}
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[activeNodesPointsArray, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            color="#ffffff"
            size={0.026}
            transparent
            opacity={0.4}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>

        {/* 5. Interactive sites/servers nodes */}
        {sites.map((site) => {
          const pos = nodePositions[site.id];
          const overriddenSite = pos
            ? { ...site, position: [pos.x, pos.y, pos.z] as [number, number, number] }
            : site;
          return (
            <SiteNode
              key={site.id}
              site={overriddenSite}
              onSelectSite={onSelectSite}
              isSelected={site.id === selectedSiteId}
            />
          );
        })}

        {/* 6. Animated Data Packets (flowing energy along connections) */}
        {Array.from({ length: packetsCount }).map((_, idx) => (
          <mesh
            key={idx}
            ref={(el) => {
              packetMeshRefs.current[idx] = el;
            }}
            visible={false}
          >
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial
              color="#00d2ff"
              transparent
              opacity={0.8}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}

export default function BrainCanvas({ sites, onSelectSite, selectedSiteId }: BrainMeshProps) {
  return (
    <div className="w-full h-full cursor-grab active:cursor-grabbing">
      <Canvas camera={{ position: [0, 0, 4.3], fov: 60 }}>
        {/* Ambient base coloring */}
        <ambientLight intensity={0.15} color="#050505" />
        
        {/* Premium monochrome + violet light highlights */}
        <pointLight position={[-5, 5, 2.5]} color="#a855f7" intensity={1.5} distance={15} />
        <pointLight position={[5, -5, 2.5]} color="#ffffff" intensity={0.8} distance={15} />
        <directionalLight position={[0, 8, 2]} color="#ffffff" intensity={0.5} />

        <BrainMesh sites={sites} onSelectSite={onSelectSite} selectedSiteId={selectedSiteId} />

        <OrbitControls 
          enableZoom={true} 
          enablePan={false} 
          minDistance={2.5} 
          maxDistance={7.0}
          rotateSpeed={0.8}
        />
      </Canvas>
    </div>
  );
}