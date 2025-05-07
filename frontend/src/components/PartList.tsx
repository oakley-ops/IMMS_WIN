import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useDebounce } from 'use-debounce';

interface Part {
  part_id: number;
  name: string;
  description: string;
  quantity: number;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  machine_id: number;
  supplier: string;
  image: string;
}

const PartList: React.FC = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  useEffect(() => {
    const fetchParts = async () => {
      try {
        const response = await axios.get<Part[]>('/api/v1/parts');
        setParts(response.data);
      } catch (error) {
        console.error('Error fetching parts:', error);
      }
    };

    fetchParts();
  }, []);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const filteredParts = parts.filter((part) =>
    part.name.toLowerCase().includes(debouncedSearchTerm[0]?.toLowerCase() || '')
  );

  return (
    <div>
      <h2>Parts List</h2>
      <input
        type="text"
        placeholder="Search by name..."
        value={searchTerm}
        onChange={handleSearchChange}
      />
      {filteredParts.map((part) => (
        <div key={part.part_id}>
          <h3>{part.name}</h3>
          <p>{part.description}</p>
        </div>
      ))}
    </div>
  );
};

export default PartList;
