import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'jotai';
import { SearchBar } from '../SearchBar';
import { searchQueryAtom, sortOrderAtom } from '@/stores/registries';
import { useAtom } from 'jotai';

// A helper component to observe atom states during the test
function StateObserver() {
    const [query] = useAtom(searchQueryAtom);
    const [sortOrder] = useAtom(sortOrderAtom);
    return (
        <div data-testid="state-observer">
            <span data-testid="query-value">{query}</span>
            <span data-testid="sort-value">{sortOrder}</span>
        </div>
    );
}

describe('SearchBar Component', () => {
    it('renders input and buttons', () => {
        render(
            <Provider>
                <SearchBar />
            </Provider>
        );

        expect(screen.getByPlaceholderText('Search characters...')).toBeInTheDocument();
        expect(screen.getByTitle('Sort by name')).toBeInTheDocument();
        expect(screen.getByTitle('Sort by date')).toBeInTheDocument();
    });

    it('updates search query on input', async () => {
        const user = userEvent.setup();
        render(
            <Provider>
                <SearchBar />
                <StateObserver />
            </Provider>
        );

        const input = screen.getByPlaceholderText('Search characters...');
        await user.type(input, 'test query');

        expect(input).toHaveValue('test query');
        expect(screen.getByTestId('query-value')).toHaveTextContent('test query');
    });

    it('toggles name sorting order when clicking name sort button', async () => {
        const user = userEvent.setup();
        render(
            <Provider>
                <SearchBar />
                <StateObserver />
            </Provider>
        );

        // Default is name-asc
        expect(screen.getByTestId('sort-value')).toHaveTextContent('name-asc');

        const nameSortBtn = screen.getByTitle('Sort by name');
        await user.click(nameSortBtn);

        expect(screen.getByTestId('sort-value')).toHaveTextContent('name-desc');

        await user.click(nameSortBtn);
        expect(screen.getByTestId('sort-value')).toHaveTextContent('name-asc');
    });

    it('toggles date sorting order when clicking date sort button', async () => {
        const user = userEvent.setup();
        render(
            <Provider>
                <SearchBar />
                <StateObserver />
            </Provider>
        );

        const dateSortBtn = screen.getByTitle('Sort by date');
        await user.click(dateSortBtn);

        expect(screen.getByTestId('sort-value')).toHaveTextContent('date-desc');

        await user.click(dateSortBtn);
        expect(screen.getByTestId('sort-value')).toHaveTextContent('date-asc');
    });
});
