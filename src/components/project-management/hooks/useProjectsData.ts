import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db, getPaginatedProfilesFromFirebase } from '../../../lib/firebase';
import { Project } from '../types';
import { POLES_ALGERIE, REGIONS_ALGERIE, WILAYAS_ALGERIE, SAMPLE_PROJECTS } from '../constants';

export function useProjectsData(initialSelectedProjectId?: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialSelectedProjectId || null);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const currentUser: any = null;
  const userProfile: any = null;
  const userRole = userProfile?.role || 'Superviseur';

  const hasPrivilege = (key: string): boolean => {
    if (userProfile?.role === 'Super Administrateur' || currentUser?.email === 'boudjada.youcef@gmail.com') return true;
    if (userProfile?.privileges && userProfile.privileges[key] !== undefined) {
      return !!userProfile.privileges[key];
    }
    return true;
  };

  // Sync user profiles from Firestore (Paginated for 10K+ scale)
  useEffect(() => {
    let isMounted = true;
    getPaginatedProfilesFromFirebase(100)
      .then((res) => {
        if (isMounted && res.items) {
          setProfilesList(res.items);
        }
      })
      .catch((err) => console.warn('Paginated profiles fetch error:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync projects from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "projects"), async (snapshot) => {
      const projectsList: Project[] = [];
      snapshot.forEach((doc) => {
        const rawData = doc.data() as any;
        const data = { ...rawData };
        if (data.identity) {
          // Map old poles to new ones
          if (!data.identity.pole || data.identity.pole === "Pôle Est - Constantine" || data.identity.pole === "Pôle Centre - Alger" || data.identity.pole === "Pôle Est") {
            data.identity.pole = "Pôle ACO (Alger - Constantine - Ouargla)";
          } else if (data.identity.pole === "Pôle Ouest - Oran" || data.identity.pole === "Pôle Sud - Ouargla" || data.identity.pole === "Pôle Ouest") {
            data.identity.pole = "Pôle BBO (Blida - Béchar - Oran)";
          } else if (!POLES_ALGERIE.includes(data.identity.pole)) {
            data.identity.pole = "Pôle ACO (Alger - Constantine - Ouargla)";
          }
          
          // Map old regions to new ones
          if (data.identity.region === "DR Constantine" || data.identity.region === "Région de transport gaz Constantine") {
            data.identity.region = "Région Constantine";
          } else if (data.identity.region === "DR Alger" || data.identity.region === "Direction de Région TG" || data.identity.region === "DR Centre" || data.identity.region === "Région de transport gaz Alger") {
            data.identity.region = "Région Alger";
          } else if (data.identity.region === "DR Blida" || data.identity.region === "Région de transport gaz Blida") {
            data.identity.region = "Région Blida";
          } else if (data.identity.region === "DR Oran" || data.identity.region === "Région de transport gaz Oran") {
            data.identity.region = "Région Oran";
          } else if (data.identity.region === "DR Béchar" || data.identity.region === "Région de transport gaz Béchar") {
            data.identity.region = "Région Béchar";
          } else if (data.identity.region === "DR Ouargla" || data.identity.region === "Région de transport gaz Ouargla") {
            data.identity.region = "Région Ouargla";
          } else if (!REGIONS_ALGERIE.includes(data.identity.region)) {
            data.identity.region = "Région Alger";
          }

          // Map old plain wilayas to numbered ones
          if (data.identity.wilaya) {
            const rawWilaya = data.identity.wilaya;
            if (!/^\d+ - /.test(rawWilaya)) {
              const matched = WILAYAS_ALGERIE.find(w => w.toLowerCase().endsWith(rawWilaya.toLowerCase()) || w.toLowerCase().includes(rawWilaya.toLowerCase()));
              if (matched) {
                data.identity.wilaya = matched;
                data.identity.district = `${matched} District`;
              }
            }
          }
        }
        projectsList.push({ id: doc.id, ...data } as Project);
      });
      
      // Auto-seed if empty
      if (projectsList.length === 0 && snapshot.metadata.fromCache === false) {
        console.log("Seeding project collection with default sample PD&I data...");
        try {
          for (const sample of SAMPLE_PROJECTS) {
            await addDoc(collection(db, "projects"), sample);
          }
        } catch (err) {
          console.error("Error seeding projects:", err);
        }
      } else {
        setProjects(projectsList);
        // Automatically select the first project if none is selected
        setSelectedProjectId(prev => prev || (projectsList.length > 0 ? projectsList[0].id : null));
      }
      setLoading(false);
    }, (error) => {
      console.error("Error loading projects from firestore:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || (projects.length > 0 ? projects[0] : null);
  }, [projects, selectedProjectId]);

  const uniqueYears = useMemo(() => {
    const years = new Set<string>();
    projects.forEach(p => {
      if (p.planning?.etudeStart) years.add(p.planning.etudeStart.substring(0, 4));
      if (p.planning?.travauxStart) years.add(p.planning.travauxStart.substring(0, 4));
      if (p.planning?.gazStart) years.add(p.planning.gazStart.substring(0, 4));
      if (p.planning?.gazEnd) years.add(p.planning.gazEnd.substring(0, 4));
    });
    return ["Tous", ...Array.from(years).sort()];
  }, [projects]);

  const uniquePoles = useMemo(() => {
    return ["Tous", ...POLES_ALGERIE];
  }, []);

  return {
    projects,
    setProjects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    uniqueYears,
    uniquePoles,
    currentUser,
    userProfile,
    userRole,
    profilesList,
    setProfilesList,
    hasPrivilege,
    loading,
    setLoading,
  };
}
