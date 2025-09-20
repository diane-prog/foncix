
"use client"
import React, { useState, useEffect } from 'react';
import { Copy, Eye, Play, Loader2, CheckCircle, Code, Settings, FileText, Download, Filter, Trash2, RefreshCw, Globe, Database, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

// Types TypeScript
interface Service {
  name: string;
  id: string;
  categories: string[];
  description: string;
  status: "Actif" | "Inactif";
  isActive: boolean;
  institutionId: string;
  icon: string | null;
  url?: string;
}

interface ApiResponse {
  services: Service[];
  categories?: string[];
}

type ServiceKeys = keyof Service;

// Fonctions utilitaires étendues
const DataUtils = {
  // Fonction de base pour sélectionner des clés
  formatServicesByKeys<T extends ServiceKeys>(services: Service[], keys: T[]): Pick<Service, T>[] {
    return services.map(service => {
      const formattedService: Partial<Service> = {};
      keys.forEach(key => {
        if (key in service) {
          formattedService[key] = service[key];
        }
      });
      return formattedService as Pick<Service, T>;
    });
  },

  // Filtrer par catégorie
  filterByCategory(services: Service[], category: string): Service[] {
    return services.filter(service =>
      service.categories.some(cat => cat.toLowerCase().includes(category.toLowerCase()))
    );
  },

  // Filtrer par statut
  filterByStatus(services: Service[], status: 'Actif' | 'Inactif' | 'all'): Service[] {
    if (status === 'all') return services;
    return services.filter(service => service.status === status);
  },

  // Recherche textuelle
  searchServices(services: Service[], query: string): Service[] {
    const lowQuery = query.toLowerCase();
    return services.filter(service =>
      service.name.toLowerCase().includes(lowQuery) ||
      service.description.toLowerCase().includes(lowQuery) ||
      service.categories.some(cat => cat.toLowerCase().includes(lowQuery))
    );
  },

  // Grouper par catégorie
  groupByCategory(services: Service[]): Record<string, Service[]> {
    const groups: Record<string, Service[]> = {};
    services.forEach(service => {
      service.categories.forEach(category => {
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(service);
      });
    });
    return groups;
  },

  // Statistiques
  getStats(services: Service[]) {
    return {
      total: services.length,
      active: services.filter(s => s.isActive).length,
      withUrl: services.filter(s => s.url).length,
      categories: [...new Set(services.flatMap(s => s.categories))].length
    };
  },

  // Transformation avancée avec schéma
  restructureServices<T extends Record<string, any>>(
    services: Service[],
    schema: { [K in keyof T]: ServiceKeys | ((service: Service) => T[K]) }
  ): T[] {
    return services.map(service => {
      const result = {} as T;
      Object.entries(schema).forEach(([key, mapper]) => {
        if (typeof mapper === 'function') {
          result[key as keyof T] = mapper(service);
        } else {
          result[key as keyof T] = service[mapper as ServiceKeys] as T[keyof T];
        }
      });
      return result;
    });
  },

  // Export vers CSV
  exportToCSV(data: any[]): string {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (Array.isArray(value)) return `"${value.join('; ')}"`;
          if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
          return value;
        }).join(',')
      )
    ].join('\n');
    return csvContent;
  }
};

// Exemples prêts à utiliser
const EXAMPLES = {
  basicSelection: {
    title: "Sélection basique",
    description: "Extraire nom, ID et statut",
    code: `return DataUtils.formatServicesByKeys(services, ['name', 'id', 'status']);`
  },
  cardFormat: {
    title: "Format carte",
    description: "Créer des cartes pour l'affichage",
    code: `return DataUtils.restructureServices(services, {
  id: 'id',
  title: 'name',
  summary: (s) => s.description.substring(0, 100) + '...',
  isOnline: (s) => !!s.url,
  badgeCount: (s) => s.categories.length,
  statusColor: (s) => s.isActive ? 'green' : 'red'
});`
  },
  analytics: {
    title: "Format analytique",
    description: "Données pour dashboard",
    code: `return DataUtils.restructureServices(services, {
  serviceId: 'id',
  serviceName: 'name',
  categoryCount: (s) => s.categories.length,
  hasWebAccess: (s) => !!s.url,
  primaryCategory: (s) => s.categories[0] || 'Non classé',
  wordCount: (s) => s.description.split(' ').length,
  institutionCode: 'institutionId'
});`
  },
  export: {
    title: "Format d'export",
    description: "Données simplifiées pour export",
    code: `return DataUtils.restructureServices(services, {
  'Nom du service': 'name',
  'Identifiant': 'id',
  'Catégories': (s) => s.categories.join(', '),
  'Description courte': (s) => s.description.substring(0, 150),
  'Actif': (s) => s.isActive ? 'Oui' : 'Non',
  'URL': (s) => s.url || 'Non disponible'
});`
  }
};

export default function AdvancedDataTransformer() {
  // États principaux
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  // États de configuration
  const [dataSource, setDataSource] = useState<'api' | 'manual'>('api');
  const [jsonData, setJsonData] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['name', 'id']);
  const [transformMode, setTransformMode] = useState<'keys' | 'custom'>('keys');
  const [customSchema, setCustomSchema] = useState('');
  const [selectedExample, setSelectedExample] = useState('');

  // États de filtrage
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Actif' | 'Inactif'>('all');

  // États UI
  const [copySuccess, setCopySuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'json' | 'table'>('json');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const availableKeys: ServiceKeys[] = [
    'name', 'id', 'categories', 'description', 'status',
    'isActive', 'institutionId', 'icon', 'url'
  ];

  // Charger les données depuis l'API
// Charger les données depuis l'API
const fetchFromAPI = async (includeCategories = true) => {
  setIsLoading(true);
  setError('');
 
  try {
    const url = includeCategories
      ? 'https://service-public.bj/api/portal/publicservices/?categories=true&eservices=true'
      : 'https://service-public.bj/api/portal/publicservices/';
   
    // Solution 1: Utiliser un proxy CORS
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
    }
   
    const textData = await response.text();
    
    // Nettoyer les données si nécessaire
    let cleanData = textData.trim();
    
    // Vérifier si les données sont complètes
    if (!cleanData.endsWith('}') && !cleanData.endsWith(']')) {
      throw new Error('Données JSON incomplètes reçues');
    }
    
    const data: ApiResponse = JSON.parse(cleanData);
    
    // Validation des données
    if (!data || typeof data !== 'object') {
      throw new Error('Format de données invalide');
    }
    
    const services = data.services || [];
    const categories = data.categories || [];
    
    setServices(services);
    setCategories(categories);
    setStats(DataUtils.getStats(services));
    
    console.log(`✅ Données chargées: ${services.length} services, ${categories.length} catégories`);
    
  } catch (err) {
    console.error('Erreur détaillée:', err);
    
    if (err instanceof Error) {
      if (err.message.includes('CORS') || err.message.includes('cors')) {
        setError('Erreur CORS: Impossible d\'accéder à l\'API. Utilisez le mode manuel ou essayez avec un proxy.');
      } else if (err.message.includes('JSON') || err.message.includes('parse')) {
        setError('Erreur JSON: Les données reçues ne sont pas au format JSON valide.');
      } else if (err.message.includes('HTTP')) {
        setError(`Erreur serveur: ${err.message}`);
      } else {
        setError(`Erreur: ${err.message}`);
      }
    } else {
      setError('Erreur inconnue lors du chargement des données');
    }
    

  } finally {
    setIsLoading(false);
  }
};

  // Charger les données manuellement
  const loadManualData = () => {
    if (!jsonData.trim()) {
      setError('Veuillez coller vos données JSON');
      return;
    }

    try {
      const parsedData = JSON.parse(jsonData);
      let servicesData: Service[] = [];

      if (parsedData.services) {
        servicesData = parsedData.services;
        setCategories(parsedData.categories || []);
      } else if (Array.isArray(parsedData)) {
        servicesData = parsedData;
        setCategories([...new Set(parsedData.flatMap((s: Service) => s.categories))]);
      } else {
        throw new Error('Format de données invalide');
      }

      setServices(servicesData);
      setStats(DataUtils.getStats(servicesData));
      setError('');
    } catch (err) {
      setError('Format JSON invalide');
    }
  };

  // Appliquer les filtres
  const getFilteredServices = (): Service[] => {
    let filtered = services;

    if (searchQuery) {
      filtered = DataUtils.searchServices(filtered, searchQuery);
    }

    if (selectedCategories.length > 0) {
      filtered = filtered.filter(service =>
        service.categories.some(cat => selectedCategories.includes(cat))
      );
    }

    if (statusFilter !== 'all') {
      filtered = DataUtils.filterByStatus(filtered, statusFilter);
    }

    return filtered;
  };

  // Traitement des données
  const processData = async () => {
    const filteredServices = getFilteredServices();
   
    if (filteredServices.length === 0) {
      setError('Aucun service ne correspond aux filtres appliqués');
      return;
    }

    if (transformMode === 'keys' && selectedKeys.length === 0) {
      setError('Veuillez sélectionner au moins une clé');
      return;
    }

    if (transformMode === 'custom' && !customSchema.trim()) {
      setError('Veuillez définir un schéma de transformation');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      let transformedData;

      if (transformMode === 'keys') {
        transformedData = DataUtils.formatServicesByKeys(filteredServices, selectedKeys as ServiceKeys[]);
      } else {
        const schemaFunction = new Function('services', 'DataUtils', `
          ${customSchema}
        `);
        transformedData = schemaFunction(filteredServices, DataUtils);
      }

      setResult(transformedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du traitement');
    } finally {
      setIsLoading(false);
    }
  };

  // Copier vers le presse-papiers
  const copyToClipboard = async () => {
    if (result) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Erreur lors de la copie:', err);
      }
    }
  };

  // Télécharger en CSV
  const downloadCSV = () => {
    if (!result) return;
    const csv = DataUtils.exportToCSV(result);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transformed_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Charger un exemple
  const loadExample = (exampleKey: string) => {
    if (exampleKey && EXAMPLES[exampleKey as keyof typeof EXAMPLES]) {
      setCustomSchema(EXAMPLES[exampleKey as keyof typeof EXAMPLES].code);
      setTransformMode('custom');
    }
  };

  // Initialisation
  useEffect(() => {
    fetchFromAPI();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header avec animation */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 mb-4">
            <Sparkles className="w-8 h-8 text-indigo-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
              Transformateur de Données Avancé
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Récupérez, filtrez, transformez et exportez vos données en toute simplicité
          </p>
         
          {/* Statistiques */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-2xl mx-auto">
              {[
                { label: 'Total', value: stats.total, color: 'blue' },
                { label: 'Actifs', value: stats.active, color: 'green' },
                { label: 'Avec URL', value: stats.withUrl, color: 'purple' },
                { label: 'Catégories', value: stats.categories, color: 'orange' }
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <div className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Panel de configuration */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center mb-6">
                <Settings className="w-6 h-6 text-indigo-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">Configuration</h2>
              </div>

              {/* Source des données */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Source des données
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDataSource('api')}
                    className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center ${
                      dataSource === 'api'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    API
                  </button>
                  <button
                    onClick={() => setDataSource('manual')}
                    className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center ${
                      dataSource === 'manual'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Manuel
                  </button>
                </div>

                {dataSource === 'api' && (
                  <button
                    onClick={() => fetchFromAPI()}
                    disabled={isLoading}
                    className="mt-3 w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Recharger depuis l'API
                  </button>
                )}
              </div>

              {/* Zone de saisie manuelle */}
              {dataSource === 'manual' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Données JSON
                  </label>
                  <textarea
                    value={jsonData}
                    onChange={(e) => setJsonData(e.target.value)}
                    placeholder="Collez vos données JSON ici..."
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                  />
                  <button
                    onClick={loadManualData}
                    className="mt-2 w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
                  >
                    Charger les données
                  </button>
                </div>
              )}

              {/* Filtres */}
              <div className="mb-6">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center">
                    <Filter className="w-4 h-4 mr-2" />
                    <span className="font-medium">Filtres</span>
                  </div>
                  {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showFilters && (
                  <div className="mt-4 space-y-4 p-4 border border-gray-200 rounded-lg">
                    {/* Recherche */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Recherche textuelle
                      </label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    {/* Filtre par statut */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Statut
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="all">Tous</option>
                        <option value="Actif">Actif</option>
                        <option value="Inactif">Inactif</option>
                      </select>
                    </div>

                    {/* Filtre par catégories */}
                    {categories.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Catégories ({selectedCategories.length} sélectionnée(s))
                        </label>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {categories.slice(0, 20).map(category => (
                            <label key={category} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedCategories.includes(category)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCategories([...selectedCategories, category]);
                                  } else {
                                    setSelectedCategories(selectedCategories.filter(c => c !== category));
                                  }
                                }}
                                className="text-indigo-600 mr-2"
                              />
                              <span className="text-sm">{category}</span>
                            </label>
                          ))}
                        </div>
                        {selectedCategories.length > 0 && (
                          <button
                            onClick={() => setSelectedCategories([])}
                            className="mt-2 text-sm text-red-600 hover:text-red-700 flex items-center"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Effacer la sélection
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mode de transformation */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Mode de transformation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTransformMode('keys')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      transformMode === 'keys'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    Clés
                  </button>
                  <button
                    onClick={() => setTransformMode('custom')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      transformMode === 'custom'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Sélection des clés */}
              {transformMode === 'keys' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Clés à extraire
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {availableKeys.map(key => (
                      <label key={key} className="flex items-center p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={selectedKeys.includes(key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKeys([...selectedKeys, key]);
                            } else {
                              setSelectedKeys(selectedKeys.filter(k => k !== key));
                            }
                          }}
                          className="text-indigo-600 mr-3"
                        />
                        <span className="text-sm font-mono">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Schéma personnalisé */}
              {transformMode === 'custom' && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Code de transformation
                    </label>
                    <select
                      value={selectedExample}
                      onChange={(e) => {
                        setSelectedExample(e.target.value);
                        loadExample(e.target.value);
                      }}
                      className="text-xs p-1 border border-gray-300 rounded"
                    >
                      <option value="">Exemples</option>
                      {Object.entries(EXAMPLES).map(([key, example]) => (
                        <option key={key} value={key}>{example.title}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={customSchema}
                    onChange={(e) => setCustomSchema(e.target.value)}
                    placeholder="return DataUtils.formatServicesByKeys(services, ['name', 'id']);"
                    className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                  />
                </div>
              )}

              {/* Bouton de traitement */}
              <button
                onClick={processData}
                disabled={isLoading || services.length === 0}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 px-4 rounded-lg hover:from-indigo-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Transformer ({getFilteredServices().length} services)
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Panel de résultats */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <FileText className="w-6 h-6 text-green-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">Résultats</h2>
                </div>
               
                {result && (
                  <div className="flex items-center space-x-2">
                    {/* Toggle view mode */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('json')}
                        className={`px-3 py-2 text-sm font-medium rounded-md transition-all ${
                          viewMode === 'json'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Code className="w-4 h-4 mr-1 inline" />
                        JSON
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-2 text-sm font-medium rounded-md transition-all ${
                          viewMode === 'table'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Eye className="w-4 h-4 mr-1 inline" />
                        Table
                      </button>
                    </div>
                   
                    {/* Actions */}
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {copySuccess ? (
                        <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                      ) : (
                        <Copy className="w-4 h-4 mr-1" />
                      )}
                      {copySuccess ? 'Copié!' : 'Copier'}
                    </button>
                   
                    <button
                      onClick={downloadCSV}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      CSV
                    </button>
                  </div>
                )}
              </div>

              {result ? (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {viewMode === 'json' ? (
                    <pre className="p-6 bg-gray-50 text-xs overflow-auto max-h-96 font-mono">
                      <code>{JSON.stringify(result, null, 2)}</code>
                    </pre>
                  ) : (
                    <div className="p-6 overflow-auto max-h-96">
                      {renderTable()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun résultat</h3>
                  <p className="text-gray-500 mb-4">
                    Les résultats transformés apparaîtront ici après traitement
                  </p>
                  {services.length === 0 && (
                    <p className="text-sm text-orange-600">
                      Chargez d'abord des données depuis l'API ou en mode manuel
                    </p>
                  )}
                </div>
              )}

              {result && (
                <div className="mt-6 flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">
                      {Array.isArray(result) ? result.length : 1} élément(s) transformé(s)
                    </span>
                    {Array.isArray(result) && result.length > 0 && (
                      <span className="ml-4">
                        {Object.keys(result[0]).length} propriété(s) par élément
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Dernière transformation: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>

            {/* Panel d'aide et exemples */}
            <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Code className="w-5 h-5 text-blue-600 mr-2" />
                Exemples d'utilisation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(EXAMPLES).map(([key, example]) => (
                  <div key={key} className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-medium text-gray-900 mb-1">{example.title}</h4>
                    <p className="text-sm text-gray-600 mb-3">{example.description}</p>
                    <button
                      onClick={() => loadExample(key)}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                    >
                      Utiliser cet exemple
                    </button>
                  </div>
                ))}
              </div>
             
              <div className="mt-6 p-4 bg-white rounded-lg border border-blue-200">
                <h4 className="font-medium text-gray-900 mb-2">Fonctions disponibles</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div><code className="text-xs bg-gray-100 px-1 rounded">DataUtils.formatServicesByKeys(services, keys)</code> - Extraction par clés</div>
                  <div><code className="text-xs bg-gray-100 px-1 rounded">DataUtils.filterByCategory(services, category)</code> - Filtrage par catégorie</div>
                  <div><code className="text-xs bg-gray-100 px-1 rounded">DataUtils.searchServices(services, query)</code> - Recherche textuelle</div>
                  <div><code className="text-xs bg-gray-100 px-1 rounded">DataUtils.groupByCategory(services)</code> - Groupement par catégorie</div>
                  <div><code className="text-xs bg-gray-100 px-1 rounded">DataUtils.getStats(services)</code> - Statistiques</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Fonction pour rendre le tableau
  function renderTable() {
    if (!result || !Array.isArray(result) || result.length === 0) return null;

    const headers = Object.keys(result[0]);
    const displayRows = result.slice(0, 50); // Limiter l'affichage

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {headers.map(header => (
                <th
                  key={header}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayRows.map((row: any, index: number) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                {headers.map(header => (
                  <td key={header} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-100">
                    {renderCellValue(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {result.length > 50 && (
          <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
            Affichage de 50 résultats sur {result.length} au total
          </div>
        )}
      </div>
    );
  }

  // Fonction pour rendre les valeurs de cellule
  function renderCellValue(value: any): React.ReactNode {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">null</span>;
    }
   
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 3).map((item, i) => (
            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {String(item)}
            </span>
          ))}
          {value.length > 3 && (
            <span className="text-xs text-gray-500">+{value.length - 3} autres</span>
          )}
        </div>
      );
    }
   
    if (typeof value === 'boolean') {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Oui' : 'Non'}
        </span>
      );
    }
   
    if (typeof value === 'object') {
      return <span className="text-gray-600 text-xs font-mono">{JSON.stringify(value)}</span>;
    }
   
    const stringValue = String(value);
    if (stringValue.length > 100) {
      return (
        <div className="max-w-xs">
          <div className="truncate" title={stringValue}>
            {stringValue}
          </div>
        </div>
      );
    }
   
    // Détecter les URLs
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline text-xs"
        >
          {value.length > 30 ? value.substring(0, 30) + '...' : value}
        </a>
      );
    }
   
    return stringValue;
  }
}